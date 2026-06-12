package com.ushanshakya.sharedcanvas

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class WidgetReceiver : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val pendingResult = goAsync()
        thread(start = true) {
            try {
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            } catch (e: Exception) {
                Log.e("WidgetReceiver", "Error in onUpdate", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.ushanshakya.sharedcanvas.APPWIDGET_REFRESH") {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetId = intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
            
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                val pendingResult = goAsync()
                thread(start = true) {
                    try {
                        updateAppWidget(context, appWidgetManager, appWidgetId)
                    } catch (e: Exception) {
                        Log.e("WidgetReceiver", "Error in onReceive APPWIDGET_REFRESH", e)
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "WidgetPrefs"
        private const val KEY_ROOM_ID = "widget_%d_roomId"
        private const val KEY_ROOM_NAME = "widget_%d_roomName"

        data class Point(val x: Double, val y: Double)
        data class Stroke(
            val id: String,
            val roomId: String,
            val userId: String,
            val points: List<Point>,
            val color: String,
            val width: Double,
            val text: String?
        )

        private fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val roomId = prefs.getString(String.format(KEY_ROOM_ID, appWidgetId), null)
            val roomName = prefs.getString(String.format(KEY_ROOM_NAME, appWidgetId), "Select Room")

            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            if (roomId.isNullOrEmpty()) {
                views.setTextViewText(R.id.widget_room_title, "Tap to setup")
                views.setImageViewBitmap(R.id.widget_canvas_image, createPlaceholderBitmap(context, "Please configure room"))
                
                // Set pending intent to open configuration activity on tap
                val configIntent = Intent(context, WidgetConfigurationActivity::class.java).apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    data = Uri.parse("sharedcanvas://widget/config/$appWidgetId")
                }
                val configPendingIntent = PendingIntent.getActivity(
                    context,
                    appWidgetId,
                    configIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_canvas_image, configPendingIntent)
                appWidgetManager.updateAppWidget(appWidgetId, views)
                return
            }

            views.setTextViewText(R.id.widget_room_title, roomName)

            // Setup Sync button intent
            val refreshIntent = Intent(context, WidgetReceiver::class.java).apply {
                action = "com.ushanshakya.sharedcanvas.APPWIDGET_REFRESH"
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                appWidgetId,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPendingIntent)

            // Setup deep link click intent on the canvas image
            val deepLinkUri = Uri.parse("sharedcanvas://rooms/$roomId/canvas")
            val deepLinkIntent = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val deepLinkPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                deepLinkIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_canvas_image, deepLinkPendingIntent)

            // Fetch strokes from REST api
            val strokes = fetchStrokes(context, roomId)
            val widthOptions = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minWidth = widthOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
            val minHeight = widthOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
            
            val density = context.resources.displayMetrics.density
            val w = (minWidth * density).toInt().coerceAtLeast(300)
            val h = (minHeight * density).toInt().coerceAtLeast(300)

            val bitmap = drawStrokes(strokes, w, h)
            views.setImageViewBitmap(R.id.widget_canvas_image, bitmap)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun createPlaceholderBitmap(context: Context, message: String): Bitmap {
            val bitmap = Bitmap.createBitmap(400, 400, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.parseColor("#1E1E1E"))
            val paint = Paint().apply {
                color = Color.GRAY
                textSize = 28f
                textAlign = Paint.Align.CENTER
                isAntiAlias = true
            }
            canvas.drawText(message, 200f, 200f, paint)
            return bitmap
        }

        private fun fetchStrokes(context: Context, roomId: String): List<Stroke> {
            try {
                val authFile = File(context.filesDir, "widget_auth.json")
                if (!authFile.exists()) return emptyList()

                val authJson = JSONObject(authFile.readText())
                val supabaseUrl = authJson.getString("supabaseUrl")
                val supabaseAnonKey = authJson.getString("supabaseAnonKey")
                val jwt = authJson.optString("jwt", "")

                val urlString = "$supabaseUrl/rest/v1/strokes?room_id=eq.$roomId&select=*"
                val url = URL(urlString)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("apikey", supabaseAnonKey)
                if (jwt.isNotEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer $jwt")
                }
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                    val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                    val arr = JSONArray(responseText)
                    val strokes = mutableListOf<Stroke>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val rId = obj.optString("room_id", "")
                        val uId = obj.optString("user_id", "")
                        val color = obj.optString("color", "")
                        val width = obj.optDouble("width", 2.0)
                        val text = if (obj.isNull("text")) null else obj.optString("text", null)

                        val pointsList = mutableListOf<Point>()
                        if (!obj.isNull("points")) {
                            val ptsArr = obj.getJSONArray("points")
                            for (j in 0 until ptsArr.length()) {
                                val ptObj = ptsArr.getJSONObject(j)
                                val x = ptObj.optDouble("x", 0.0)
                                val y = ptObj.optDouble("y", 0.0)
                                pointsList.add(Point(x, y))
                            }
                        }
                        strokes.add(Stroke(id, rId, uId, pointsList, color, width, text))
                    }
                    return strokes
                }
            } catch (e: Exception) {
                Log.e("WidgetReceiver", "Failed to fetch strokes", e)
            }
            return emptyList()
        }

        private fun drawStrokes(strokes: List<Stroke>, width: Int, height: Int): Bitmap {
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.parseColor("#1E1E1E"))

            if (strokes.isEmpty()) {
                val paint = Paint().apply {
                    color = Color.GRAY
                    textSize = width.toFloat() * 0.05f
                    textAlign = Paint.Align.CENTER
                    isAntiAlias = true
                }
                canvas.drawText("No drawings yet", width / 2f, height / 2f, paint)
                return bitmap
            }

            // Determine bounds
            var minX = Double.MAX_VALUE
            var maxX = -Double.MAX_VALUE
            var minY = Double.MAX_VALUE
            var maxY = -Double.MAX_VALUE
            var hasPoints = false

            for (stroke in strokes) {
                for (pt in stroke.points) {
                    hasPoints = true
                    if (pt.x < minX) minX = pt.x
                    if (pt.x > maxX) maxX = pt.x
                    if (pt.y < minY) minY = pt.y
                    if (pt.y > maxY) maxY = pt.y
                }
            }

            if (!hasPoints) {
                minX = 0.0
                maxX = 100.0
                minY = 0.0
                maxY = 100.0
            }

            val boundsWidth = maxX - minX
            val boundsHeight = maxY - minY

            val padding = 20f
            val drawWidth = width.toFloat() - padding * 2
            val drawHeight = height.toFloat() - padding * 2

            val scale = if (boundsWidth == 0.0 || boundsHeight == 0.0) {
                1.0f
            } else {
                val scaleX = drawWidth / boundsWidth.toFloat()
                val scaleY = drawHeight / boundsHeight.toFloat()
                Math.min(Math.min(scaleX, scaleY), 2.0f)
            }

            val finalDrawWidth = boundsWidth.toFloat() * scale
            val finalDrawHeight = boundsHeight.toFloat() * scale
            val offsetX = padding + (drawWidth - finalDrawWidth) / 2.0f
            val offsetY = padding + (drawHeight - finalDrawHeight) / 2.0f
            val transX = offsetX - (minX.toFloat() * scale)
            val transY = offsetY - (minY.toFloat() * scale)

            val paint = Paint().apply {
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                isAntiAlias = true
            }

            val textPaint = Paint().apply {
                style = Paint.Style.FILL
                isAntiAlias = true
            }

            for (stroke in strokes) {
                if (stroke.color == "eraser") continue
                
                val strokeColor = parseColor(stroke.color)
                val strokeWidth = stroke.width.toFloat() * scale
                
                if (stroke.text != null) {
                    if (stroke.points.isNotEmpty()) {
                        val first = stroke.points[0]
                        val x = first.x.toFloat() * scale + transX
                        val y = first.y.toFloat() * scale + transY
                        textPaint.color = strokeColor
                        textPaint.textSize = Math.max(12.0f, strokeWidth)
                        canvas.drawText(stroke.text, x, y, textPaint)
                    }
                } else {
                    if (stroke.points.size > 1) {
                        paint.color = strokeColor
                        paint.strokeWidth = strokeWidth
                        
                        val path = android.graphics.Path()
                        val first = stroke.points[0]
                        path.moveTo(first.x.toFloat() * scale + transX, first.y.toFloat() * scale + transY)
                        
                        for (i in 1 until stroke.points.size) {
                            val pt = stroke.points[i]
                            path.lineTo(pt.x.toFloat() * scale + transX, pt.y.toFloat() * scale + transY)
                        }
                        canvas.drawPath(path, paint)
                    }
                }
            }

            return bitmap
        }

        private fun parseColor(hex: String): Int {
            var cleanHex = hex.trim().uppercase()
            if (cleanHex.startsWith("#")) {
                cleanHex = cleanHex.substring(1)
            }
            if (cleanHex.length != 6) {
                return Color.GRAY
            }
            return try {
                Color.parseColor("#$cleanHex")
            } catch (e: Exception) {
                Color.GRAY
            }
        }
    }
}
