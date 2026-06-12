import WidgetKit
import SwiftUI
import AppIntents

struct Point: Codable {
    let x: Double
    let y: Double
}

struct Stroke: Codable, Identifiable {
    let id: String
    let roomId: String
    let userId: String
    let points: [Point]
    let color: String
    let width: Double
    let text: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case roomId = "room_id"
        case userId = "user_id"
        case points
        case color
        case width
        case text
    }
}

struct AuthPayload: Codable {
    let supabaseUrl: String
    let supabaseAnonKey: String
    let jwt: String?
}

struct RoomsPayload: Codable {
    struct Room: Codable {
        let id: String
        let name: String
    }
    let rooms: [Room]
}

struct RoomEntity: AppEntity {
    let id: String
    let name: String
    
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Room"
    static var defaultQuery = RoomQuery()
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct RoomQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [RoomEntity] {
        return try await RoomOptionsProvider().results().filter { identifiers.contains($0.id) }
    }
    func suggestedEntities() async throws -> [RoomEntity] {
        return try await RoomOptionsProvider().results()
    }
}

struct RoomOptionsProvider: DynamicOptionsProvider {
    func results() async throws -> [RoomEntity] {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.ushanshakya.sharedcanvas") else {
            return []
        }
        let fileURL = containerURL.appendingPathComponent("widget_rooms.json")
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        guard let payload = try? JSONDecoder().decode(RoomsPayload.self, from: data) else { return [] }
        return payload.rooms.map { RoomEntity(id: $0.id, name: $0.name) }
    }
}

struct SelectRoomIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Room"
    
    @Parameter(title: "Room", optionsProvider: RoomOptionsProvider())
    var room: RoomEntity?
}

struct CanvasWidgetEntry: TimelineEntry {
    let date: Date
    let roomId: String
    let roomName: String
    let strokes: [Stroke]
}

struct Provider: AppIntentTimelineProvider {
    typealias Entry = CanvasWidgetEntry
    typealias Intent = SelectRoomIntent
    
    func placeholder(in context: Context) -> CanvasWidgetEntry {
        CanvasWidgetEntry(date: Date(), roomId: "", roomName: "Sample Room", strokes: [])
    }
    
    func snapshot(for configuration: SelectRoomIntent, in context: Context) async -> CanvasWidgetEntry {
        let roomName = configuration.room?.name ?? "No Room"
        let roomId = configuration.room?.id ?? ""
        return CanvasWidgetEntry(date: Date(), roomId: roomId, roomName: roomName, strokes: [])
    }
    
    func timeline(for configuration: SelectRoomIntent, in context: Context) async -> Timeline<CanvasWidgetEntry> {
        let roomName = configuration.room?.name ?? "No Room"
        let roomId = configuration.room?.id ?? ""
        
        var strokes: [Stroke] = []
        if !roomId.isEmpty {
            strokes = await fetchStrokesAsync(roomId: roomId)
        }
        
        let entry = CanvasWidgetEntry(date: Date(), roomId: roomId, roomName: roomName, strokes: strokes)
        
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func fetchStrokesAsync(roomId: String) async -> [Stroke] {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.ushanshakya.sharedcanvas") else {
            return []
        }
        let authURL = containerURL.appendingPathComponent("widget_auth.json")
        guard let authData = try? Data(contentsOf: authURL),
              let auth = try? JSONDecoder().decode(AuthPayload.self, from: authData) else {
            return []
        }
        
        let urlString = "\(auth.supabaseUrl)/rest/v1/strokes?room_id=eq.\(roomId)&select=*"
        guard let url = URL(string: urlString) else {
            return []
        }
        
        var request = URLRequest(url: url)
        request.setValue(auth.supabaseAnonKey, forHTTPHeaderField: "apikey")
        if let jwt = auth.jwt, !jwt.isEmpty {
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        }
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let strokes = try JSONDecoder().decode([Stroke].self, from: data)
            return strokes
        } catch {
            print("[CanvasWidget] Error fetching strokes: \(error)")
            return []
        }
    }
}

func colorFromHex(_ hex: String) -> Color {
    var cString: String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

    if cString.hasPrefix("#") {
        cString.remove(at: cString.startIndex)
    }

    if cString.count != 6 {
        return Color.gray
    }

    var rgbValue: UInt64 = 0
    Scanner(string: cString).scanHexInt64(&rgbValue)

    return Color(
        red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
        green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
        blue: CGFloat(rgbValue & 0x0000FF) / 255.0
    )
}

struct CanvasView: View {
    let strokes: [Stroke]
    
    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let bounds = getBounds()
            let scale = getScale(bounds: bounds, size: size)
            let translation = getTranslation(bounds: bounds, size: size, scale: scale)
            
            ZStack {
                ForEach(strokes) { stroke in
                    if stroke.color != "eraser" {
                        if let text = stroke.text {
                            if let firstPoint = stroke.points.first {
                                Text(text)
                                    .font(.system(size: max(8, stroke.width * scale)))
                                    .foregroundColor(colorFromHex(stroke.color))
                                    .position(
                                        x: (firstPoint.x * scale) + translation.x,
                                        y: (firstPoint.y * scale) + translation.y
                                    )
                            }
                        } else {
                            Path { path in
                                guard stroke.points.count > 1 else { return }
                                let first = stroke.points[0]
                                path.move(to: CGPoint(
                                    x: (first.x * scale) + translation.x,
                                    y: (first.y * scale) + translation.y
                                ))
                                for pt in stroke.points.dropFirst() {
                                    path.addLine(to: CGPoint(
                                        x: (pt.x * scale) + translation.x,
                                        y: (pt.y * scale) + translation.y
                                    ))
                                }
                            }
                            .stroke(
                                colorFromHex(stroke.color),
                                style: StrokeStyle(lineWidth: stroke.width * scale, lineCap: .round, lineJoin: .round)
                            )
                        }
                    }
                }
            }
        }
    }
    
    private func getBounds() -> CGRect {
        var minX = Double.greatestFiniteMagnitude
        var maxX = -Double.greatestFiniteMagnitude
        var minY = Double.greatestFiniteMagnitude
        var maxY = -Double.greatestFiniteMagnitude
        
        var hasPoints = false
        for stroke in strokes {
            for pt in stroke.points {
                hasPoints = true
                if pt.x < minX { minX = pt.x }
                if pt.x > maxX { maxX = pt.x }
                if pt.y < minY { minY = pt.y }
                if pt.y > maxY { maxY = pt.y }
            }
        }
        
        if !hasPoints {
            return CGRect(x: 0, y: 0, width: 100, height: 100)
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
    
    private func getScale(bounds: CGRect, size: CGSize) -> CGFloat {
        if bounds.width == 0 || bounds.height == 0 { return 1.0 }
        let scaleX = (size.width - 20) / bounds.width
        let scaleY = (size.height - 20) / bounds.height
        return min(min(scaleX, scaleY), 2.0)
    }
    
    private func getTranslation(bounds: CGRect, size: CGSize, scale: CGFloat) -> CGPoint {
        let drawWidth = bounds.width * scale
        let drawHeight = bounds.height * scale
        let offsetX = 10.0 + (size.width - 20.0 - drawWidth) / 2.0
        let offsetY = 10.0 + (size.height - 20.0 - drawHeight) / 2.0
        return CGPoint(
            x: offsetX - (bounds.minX * scale),
            y: offsetY - (bounds.minY * scale)
        )
    }
}

struct CanvasWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.roomName)
                    .font(.caption)
                    .bold()
                    .foregroundColor(.white)
                Spacer()
                Circle()
                    .fill(Color.green)
                    .frame(width: 6, height: 6)
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            
            if entry.strokes.isEmpty {
                VStack {
                    Spacer()
                    Text("No drawings yet")
                        .font(.footnote)
                        .foregroundColor(.gray)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                CanvasView(strokes: entry.strokes)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.1))
                    .cornerRadius(8)
                    .padding([.horizontal, .bottom], 6)
            }
        }
        .containerBackground(Color(white: 0.15), for: .widget)
    }
}

struct CanvasWidget: Widget {
    let kind: String = "CanvasWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectRoomIntent.self, provider: Provider()) { entry in
            CanvasWidgetEntryView(entry: entry)
                .widgetURL(URL(string: "sharedcanvas://rooms/\(entry.roomId)/canvas"))
        }
        .configurationDisplayName("Shared Canvas")
        .description("View dynamic collaborative canvas drawings on your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
