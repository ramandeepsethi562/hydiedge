package com.hydiedge.mobile.ui

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.hydiedge.mobile.location.GpsBreadcrumbService
import com.hydiedge.mobile.screentime.ScreenTimeTracker
import com.hydiedge.mobile.sync.BatchSyncWorker
import com.hydiedge.mobile.telephony.TelephonyCallReceiver
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Schedule background worker
        val syncRequest = PeriodicWorkRequestBuilder<BatchSyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            BatchSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )

        setContent {
            HydiEdgeTheme {
                MainScreen(
                    onStartGpsService = { startGpsService() },
                    onRequestUsageStats = { requestUsageStatsPermission() }
                )
            }
        }
    }

    private fun startGpsService() {
        val intent = Intent(this, GpsBreadcrumbService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun requestUsageStatsPermission() {
        if (!hasUsageStatsPermission()) {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            startActivity(intent)
        }
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}

@Composable
fun HydiEdgeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF2563EB),
            secondary = Color(0xFF10B981),
            background = Color(0xFF090D16),
            surface = Color(0xFF0F172A),
            onPrimary = Color.White,
            onSecondary = Color.White,
            onBackground = Color(0xFFF8FAFC),
            onSurface = Color(0xFFF8FAFC)
        ),
        content = content
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onStartGpsService: () -> Unit,
    onRequestUsageStats: () -> Unit
) {
    val context = LocalContext.current
    var lastSync by remember { mutableStateOf(BatchSyncWorker.getLastSyncTime(context)) }
    var isSyncing by remember { mutableStateOf(false) }

    val config = remember { BatchSyncWorker.getConfig(context) }
    var serverUrl by remember { mutableStateOf(config.first) }
    var employeeId by remember { mutableStateOf(config.second) }
    var deviceId by remember { mutableStateOf(config.third) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    // Metrics state
    val bufferedCalls = remember { mutableStateOf(TelephonyCallReceiver.getBufferedCalls(context)) }
    val bufferedGps = remember { mutableStateOf(GpsBreadcrumbService.getBufferedBreadcrumbs(context)) }
    val screenTimeTracker = remember { ScreenTimeTracker(context) }
    val screenTimeList = remember { mutableStateOf(screenTimeTracker.collectDailyScreenTime()) }

    // Permission Request Launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        if (fineLocationGranted) {
            onStartGpsService()
        }
    }

    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_CONTACTS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(permissionsToRequest.toTypedArray())
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "HYDIEDGE",
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFF60A5FA),
                            fontSize = 18.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Field & Telephony",
                            fontSize = 14.sp,
                            color = Color.LightGray
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showSettingsDialog = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0B132B)
                )
            )
        },
        bottomBar = {
            Surface(
                color = Color(0xFF0B132B),
                modifier = Modifier.fillMaxWidth()
            ) {
                Button(
                    onClick = {
                        isSyncing = true
                        val syncRequest = OneTimeWorkRequestBuilder<BatchSyncWorker>().build()
                        WorkManager.getInstance(context).enqueue(syncRequest)

                        Toast.makeText(context, "Batch sync dispatched to $serverUrl", Toast.LENGTH_SHORT).show()

                        // Refresh UI metrics after a brief delay
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            lastSync = BatchSyncWorker.getLastSyncTime(context)
                            bufferedCalls.value = TelephonyCallReceiver.getBufferedCalls(context)
                            bufferedGps.value = GpsBreadcrumbService.getBufferedBreadcrumbs(context)
                            screenTimeList.value = screenTimeTracker.collectDailyScreenTime()
                            isSyncing = false
                        }, 2500)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    if (isSyncing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Syncing with HydiEdge Core...")
                    } else {
                        Icon(Icons.Default.Sync, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sync Telephony & Field Batch Now", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF090D16))
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Spacer(modifier = Modifier.height(2.dp))

            // Active State Banner
            StatusBanner(employeeId = employeeId, deviceId = deviceId, lastSync = lastSync)

            // Card 1: Telephony & Calls
            DashboardCard(
                title = "TELEPHONY & CALL LOGS",
                icon = Icons.Default.Call,
                badge = "${bufferedCalls.value.size} Buffered Calls"
            ) {
                Text(
                    text = "Real-time call tracking intercepts incoming/outgoing calls, duration, and phone contacts.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MetricMiniBox(label = "Calls Today", value = "${bufferedCalls.value.size}")
                    MetricMiniBox(label = "Inbound", value = "${bufferedCalls.value.count { it.callType == "INCOMING" }}")
                    MetricMiniBox(label = "Outbound", value = "${bufferedCalls.value.count { it.callType == "OUTGOING" }}")
                    MetricMiniBox(label = "Missed", value = "${bufferedCalls.value.count { it.callType == "MISSED" }}")
                }
            }

            // Card 2: Screen Time & Apps
            DashboardCard(
                title = "MOBILE SCREEN TIME",
                icon = Icons.Default.PhoneAndroid,
                badge = "${screenTimeList.value.size} Apps Logged"
            ) {
                Text(
                    text = "UsageStatsManager tracks active foreground work apps, communication, and breaks.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.height(8.dp))

                if (screenTimeList.value.isEmpty()) {
                    Button(
                        onClick = onRequestUsageStats,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Grant Usage Access Permission", fontSize = 12.sp, color = Color(0xFF60A5FA))
                    }
                } else {
                    screenTimeList.value.take(4).forEach { item ->
                        val mins = item.screenTimeSeconds / 60
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = item.appName, fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.Medium)
                            Text(
                                text = "${mins}m (${item.category})",
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                color = if (item.category == "PRODUCTIVE") Color(0xFF34D399) else Color(0xFF94A3B8)
                            )
                        }
                    }
                }
            }

            // Card 3: GPS & Geofencing
            DashboardCard(
                title = "FIELD GPS & GEOFENCING",
                icon = Icons.Default.LocationOn,
                badge = "${bufferedGps.value.size} Breadcrumbs"
            ) {
                Text(
                    text = "Continuous fused location provider generates verified route breadcrumbs every 60s.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val latestGps = bufferedGps.value.lastOrNull()
                    MetricMiniBox(
                        label = "Latitude",
                        value = latestGps?.latitude?.let { String.format("%.4f", it) } ?: "28.6139"
                    )
                    MetricMiniBox(
                        label = "Longitude",
                        value = latestGps?.longitude?.let { String.format("%.4f", it) } ?: "77.2090"
                    )
                    MetricMiniBox(
                        label = "Speed",
                        value = "${latestGps?.speedKmh?.toInt() ?: 0} km/h"
                    )
                    MetricMiniBox(
                        label = "Battery",
                        value = "${latestGps?.batteryPct ?: 88}%"
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showSettingsDialog) {
        AlertDialog(
            onDismissRequest = { showSettingsDialog = false },
            title = { Text("Server & Device Settings") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("Server API URL") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = employeeId,
                        onValueChange = { employeeId = it },
                        label = { Text("Employee ID") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = deviceId,
                        onValueChange = { deviceId = it },
                        label = { Text("Device ID") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        BatchSyncWorker.saveConfig(context, serverUrl, employeeId, deviceId)
                        showSettingsDialog = false
                        Toast.makeText(context, "Settings saved!", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showSettingsDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun StatusBanner(employeeId: String, deviceId: String, lastSync: String) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(Color(0xFF10B981), shape = RoundedCornerShape(50))
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Agent Online • Tracking Active",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = Color.White
                )
                Text(
                    text = "$employeeId | $deviceId | Last Sync: $lastSync",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = Color(0xFF64748B)
                )
            }
        }
    }
}

@Composable
fun DashboardCard(
    title: String,
    icon: ImageVector,
    badge: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = Color(0xFF60A5FA), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFF1E293B)
                ) {
                    Text(
                        text = badge,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFF38BDF8),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
fun MetricMiniBox(label: String, value: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF1E293B),
        modifier = Modifier.width(74.dp)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = label, fontSize = 9.sp, color = Color(0xFF94A3B8))
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White, fontFamily = FontFamily.Monospace)
        }
    }
}
