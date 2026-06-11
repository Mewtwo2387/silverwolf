package com.example.silverwolf.ui.main

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.navigation3.runtime.NavKey
import androidx.webkit.WebViewAssetLoader
import com.example.silverwolf.CookieHelper
import com.example.silverwolf.LoginSessionManager
import com.example.silverwolf.NetworkMonitor
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val PREFS_NAME = "silverwolf_prefs"
private const val KEY_SERVER_URL = "server_url"
private const val KEY_FORCE_OFFLINE = "force_offline"
private const val DEFAULT_SERVER_URL = "http://10.0.2.2:6769"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onItemClick: (NavKey) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sharedPrefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

    // State properties
    var serverUrl by remember { mutableStateOf(sharedPrefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL) }
    var forceOffline by remember { mutableStateOf(sharedPrefs.getBoolean(KEY_FORCE_OFFLINE, false)) }
    var showSettings by remember { mutableStateOf(false) }

    // Monitor Network Connectivity
    val networkMonitor = remember { NetworkMonitor(context) }
    val isNetworkOnline by networkMonitor.isOnline.collectAsState(initial = true)

    // Determine active online status
    val isAppOnline = isNetworkOnline && !forceOffline

    // Track active WebView instance
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    // Handle deep linked session tokens
    LaunchedEffect(serverUrl) {
        LoginSessionManager.sessionFlow.collectLatest { sessionToken ->
            // Save the session cookie to CookieManager
            CookieHelper.setSessionCookie(serverUrl, sessionToken)
            
            // Reload WebView pointing to dashboard /me
            webViewInstance?.post {
                webViewInstance?.loadUrl("$serverUrl/me")
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Silverwolf",
                            style = MaterialTheme.typography.titleMedium
                        )
                        // Online / Offline Badge
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = if (isAppOnline) Color(0xFF22C55E) else Color(0xFFEF4444)
                        ) {
                            Text(
                                text = if (isAppOnline) "ONLINE" else "OFFLINE",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { webViewInstance?.reload() }) {
                        Icon(imageVector = Icons.Default.Refresh, contentDescription = "Reload")
                    }
                    IconButton(onClick = { showSettings = true }) {
                        Icon(imageVector = Icons.Default.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF06080F),
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFF06080F))
        ) {
            WebViewContainer(
                serverUrl = serverUrl,
                isOnline = isAppOnline,
                onWebViewReady = { webView ->
                    webViewInstance = webView
                }
            )
        }
    }

    // Settings Dialog
    if (showSettings) {
        SettingsDialog(
            currentServerUrl = serverUrl,
            currentForceOffline = forceOffline,
            onDismiss = { showSettings = false },
            onSave = { newUrl, newForceOffline ->
                serverUrl = newUrl
                forceOffline = newForceOffline
                sharedPrefs.edit()
                    .putString(KEY_SERVER_URL, newUrl)
                    .putBoolean(KEY_FORCE_OFFLINE, newForceOffline)
                    .apply()
                showSettings = false
                
                // Reload WebView based on new settings
                webViewInstance?.post {
                    if (newForceOffline) {
                        webViewInstance?.loadUrl("https://appassets.androidplatform.net/assets/offline/index.html")
                    } else {
                        webViewInstance?.loadUrl(newUrl)
                    }
                }
            }
        )
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun WebViewContainer(
    serverUrl: String,
    isOnline: Boolean,
    onWebViewReady: (WebView) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    // Set up WebViewAssetLoader to serve local assets
    val assetLoader = remember {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    // Add a custom UA header so Hono backend knows it's the mobile app if needed
                    userAgentString = "$userAgentString SilverwolfAndroidApp"
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        // Forward request to AssetLoader if URL starts with appassets host
                        return if (request.url.host == "appassets.androidplatform.net") {
                            assetLoader.shouldInterceptRequest(request.url)
                        } else {
                            super.shouldInterceptRequest(view, request)
                        }
                    }

                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        val urlString = request.url.toString()

                        // Intercept login route and open in external browser
                        if (urlString.contains("/auth/discord/login")) {
                            val uri = Uri.parse(urlString)
                            val builder = uri.buildUpon()
                            // Force app=true param so callback deep links back
                            if (uri.getQueryParameter("app") == null) {
                                builder.appendQueryParameter("app", "true")
                            }
                            val intent = Intent(Intent.ACTION_VIEW, builder.build())
                            ctx.startActivity(intent)
                            return true
                        }

                        // Intercept external links or Discord auth pages
                        val serverHost = Uri.parse(serverUrl).host
                        val requestHost = request.url.host
                        if (requestHost != null && requestHost != serverHost && requestHost != "appassets.androidplatform.net") {
                            val intent = Intent(Intent.ACTION_VIEW, request.url)
                            ctx.startActivity(intent)
                            return true
                        }

                        return false
                    }
                }

                onWebViewReady(this)

                // Load initial page
                if (isOnline) {
                    loadUrl(serverUrl)
                } else {
                    loadUrl("https://appassets.androidplatform.net/assets/offline/index.html")
                }
            }
        },
        update = { webView ->
            // Handle online/offline transitions dynamically
            val currentUrl = webView.url
            if (isOnline) {
                if (currentUrl == null || currentUrl.startsWith("https://appassets.androidplatform.net")) {
                    webView.loadUrl(serverUrl)
                }
            } else {
                if (currentUrl == null || !currentUrl.startsWith("https://appassets.androidplatform.net")) {
                    webView.loadUrl("https://appassets.androidplatform.net/assets/offline/index.html")
                }
            }
        }
    )
}

@Composable
private fun SettingsDialog(
    currentServerUrl: String,
    currentForceOffline: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, Boolean) -> Unit
) {
    var urlInput by remember { mutableStateOf(currentServerUrl) }
    var forceOfflineChecked by remember { mutableStateOf(currentForceOffline) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF0F121E)
            )
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "App Settings",
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White
                )

                // Server URL input
                OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    label = { Text("Hono Server URL") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF4C6EF5),
                        unfocusedBorderColor = Color(0xFF3B3E5C)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                // Force Offline checkbox
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Checkbox(
                        checked = forceOfflineChecked,
                        onCheckedChange = { forceOfflineChecked = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Color(0xFF4C6EF5)
                        )
                    )
                    Text(
                        text = "Force Offline Mode",
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                // Actions row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = Color.Gray)
                    }
                    Button(
                        onClick = { onSave(urlInput, forceOfflineChecked) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF4C6EF5)
                        )
                    ) {
                        Text("Save")
                    }
                }
            }
        }
    }
}
