package expo.modules.sharedgroup

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SharedGroupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SharedGroup")

    Function("getAppGroupPath") {
      null as String?
    }

    Function("reloadWidget") {
      val context = appContext.reactContext
      if (context != null) {
        try {
          val widgetReceiverClass = Class.forName("com.ushanshakya.sharedcanvas.WidgetReceiver")
          val intent = Intent(context, widgetReceiverClass).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val ids = appWidgetManager.getAppWidgetIds(
              ComponentName(context, widgetReceiverClass)
            )
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
          }
          context.sendBroadcast(intent)
        } catch (e: Exception) {
          // Class not found or other broadcast issue
        }
      }
    }
  }
}
