package com.eldercare.plugins

import android.content.Intent
import android.provider.AlarmClock
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AlarmPlugin")
class AlarmPlugin : Plugin() {

    @PluginMethod
    fun setAlarm(call: PluginCall) {
        val hour = call.getInt("hour")
        val minute = call.getInt("minute")
        val message = call.getString("message", "用藥提醒")
        val skipUi = call.getBoolean("skipUi", false)

        if (hour == null || minute == null) {
            call.reject("Hour and minute are required")
            return
        }

        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, message)
            putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi)
        }

        try {
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to set alarm: ${e.message}")
        }
    }
}
