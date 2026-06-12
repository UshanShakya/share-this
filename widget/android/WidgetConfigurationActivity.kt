package com.ushanshakya.sharedcanvas

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.File

class WidgetConfigurationActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set result to CANCELED in case the user backs out
        setResult(Activity.RESULT_CANCELED)

        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setupConfigurationDialog()
    }

    private fun setupConfigurationDialog() {
        val roomsFile = File(filesDir, "widget_rooms.json")
        if (!roomsFile.exists()) {
            showErrorAndExit("Please log in to the Shared Canvas app and join or create a canvas first!")
            return
        }

        val roomList = mutableListOf<Pair<String, String>>() // Pair of (id, name)
        try {
            val json = JSONObject(roomsFile.readText())
            val roomsArray = json.getJSONArray("rooms")
            for (i in 0 until roomsArray.length()) {
                val r = roomsArray.getJSONObject(i)
                roomList.add(Pair(r.getString("id"), r.getString("name")))
            }
        } catch (e: Exception) {
            Log.e("WidgetConfigActivity", "Failed to parse widget_rooms.json", e)
            showErrorAndExit("Invalid app data. Please open the app and refresh your room list.")
            return
        }

        if (roomList.isEmpty()) {
            showErrorAndExit("No rooms found. Please create or join a room in the app first!")
            return
        }

        val roomNames = roomList.map { it.second }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Select a Room")
            .setItems(roomNames) { _, which ->
                val selectedRoom = roomList[which]
                saveRoomPreference(selectedRoom.first, selectedRoom.second)
                finishConfiguration()
            }
            .setNegativeButton("Cancel") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showErrorAndExit(message: String) {
        AlertDialog.Builder(this)
            .setTitle("Configuration Required")
            .setMessage(message)
            .setPositiveButton("OK") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun saveRoomPreference(roomId: String, roomName: String) {
        val prefs = getSharedPreferences("WidgetPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(String.format("widget_%d_roomId", appWidgetId), roomId)
            putString(String.format("widget_%d_roomName", appWidgetId), roomName)
            apply()
        }

        // Notify WidgetReceiver to update the newly added widget
        val updateIntent = Intent(this, WidgetReceiver::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
        }
        sendBroadcast(updateIntent)
    }

    private fun finishConfiguration() {
        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(Activity.RESULT_OK, resultValue)
        finish()
    }
}
