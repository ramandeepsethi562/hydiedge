package com.hydiedge.mobile.telephony

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.CallLog
import android.provider.ContactsContract
import android.telephony.TelephonyManager
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hydiedge.mobile.model.CallLogEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class TelephonyCallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "TelephonyCallReceiver"
        private const val PREFS_NAME = "hydiedge_telephony_spool"
        private const val KEY_PENDING_CALLS = "pending_calls"
        private var lastState = TelephonyManager.CALL_STATE_IDLE
        private var isIncoming = false
        private var savedNumber: String? = null

        fun getBufferedCalls(context: Context): List<CallLogEntry> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_PENDING_CALLS, null) ?: return emptyList()
            val type = object : TypeToken<List<CallLogEntry>>() {}.type
            return try {
                Gson().fromJson(json, type) ?: emptyList()
            } catch (e: Exception) {
                emptyList()
            }
        }

        fun clearBufferedCalls(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().remove(KEY_PENDING_CALLS).apply()
        }

        fun saveCallToSpool(context: Context, entry: CallLogEntry) {
            val current = getBufferedCalls(context).toMutableList()
            current.add(entry)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_PENDING_CALLS, Gson().toJson(current)).apply()
            Log.d(TAG, "Spool saved call with ${entry.callerName} (${entry.durationSeconds}s). Total in spool: ${current.size}")
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_NEW_OUTGOING_CALL) {
            savedNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)
            isIncoming = false
            return
        }

        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

            val state = when (stateStr) {
                TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
                TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
                TelephonyManager.EXTRA_STATE_IDLE -> TelephonyManager.CALL_STATE_IDLE
                else -> TelephonyManager.CALL_STATE_IDLE
            }

            onCustomCallStateChanged(context, state, incomingNumber)
        }
    }

    private fun onCustomCallStateChanged(context: Context, state: Int, number: String?) {
        if (lastState == state) return

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                isIncoming = true
                savedNumber = number
                Log.d(TAG, "Call State: RINGING from $savedNumber")
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                Log.d(TAG, "Call State: OFFHOOK (Call Connected)")
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended or missed
                Log.d(TAG, "Call State: IDLE (Call Ended). Reading latest CallLog...")
                readAndSpoolLastCall(context)
                isIncoming = false
                savedNumber = null
            }
        }
        lastState = state
    }

    @SuppressLint("Range")
    private fun readAndSpoolLastCall(context: Context) {
        try {
            val cursor: Cursor? = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null,
                null,
                null,
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                if (it.moveToFirst()) {
                    val phNumber = it.getString(it.getColumnIndex(CallLog.Calls.NUMBER)) ?: "Unknown"
                    val callTypeInt = it.getInt(it.getColumnIndex(CallLog.Calls.TYPE))
                    val callDateLong = it.getLong(it.getColumnIndex(CallLog.Calls.DATE))
                    val callDuration = it.getInt(it.getColumnIndex(CallLog.Calls.DURATION))

                    val callType = when (callTypeInt) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        else -> if (isIncoming) "INCOMING" else "OUTGOING"
                    }

                    val callerName = resolveContactName(context, phNumber) ?: "Customer Contact"
                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    val callTimeUtc = sdf.format(Date(callDateLong))

                    val entry = CallLogEntry(
                        callerName = callerName,
                        phoneNumber = phNumber,
                        callType = callType,
                        callTimeUtc = callTimeUtc,
                        durationSeconds = callDuration,
                        notes = "Captured natively by HydiEdge Android Service"
                    )

                    saveCallToSpool(context, entry)
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for CallLog: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error querying CallLog: ${e.message}")
        }
    }

    private fun resolveContactName(context: Context, phoneNumber: String): String? {
        return try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
            val cursor = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    it.getString(0)
                } else null
            }
        } catch (e: Exception) {
            null
        }
    }
}
