import ExpoModulesCore
import WidgetKit

public class SharedGroupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SharedGroup")

    Function("getAppGroupPath") { () -> String? in
      let fm = FileManager.default
      let containerURL = fm.containerURL(forSecurityApplicationGroupIdentifier: "group.com.ushanshakya.sharedcanvas")
      return containerURL?.path
    }

    Function("reloadWidget") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
