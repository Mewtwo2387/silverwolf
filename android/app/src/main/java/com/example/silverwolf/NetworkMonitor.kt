package com.example.silverwolf

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.util.Log
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

class NetworkMonitor(private val context: Context) {
    val isOnline: Flow<Boolean> = callbackFlow {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        // Track the *default* network only. On a handoff (e.g. Wi-Fi -> cellular)
        // the system reports onAvailable for the new default; onLost fires solely
        // when there is no default network left — i.e. genuinely offline. This
        // avoids the false "offline" blips a plain NetworkCallback emits when one
        // of several networks drops while another stays up.
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }

            override fun onLost(network: Network) {
                trySend(false)
            }
        }

        try {
            connectivityManager.registerDefaultNetworkCallback(callback)
        } catch (e: Exception) {
            // Don't trap the user offline if registration fails — assume online.
            Log.w("NetworkMonitor", "registerDefaultNetworkCallback failed", e)
            trySend(true)
        }

        // Seed the initial state from the current default network.
        trySend(connectivityManager.activeNetwork != null)

        awaitClose {
            try {
                connectivityManager.unregisterNetworkCallback(callback)
            } catch (e: Exception) {
                Log.w("NetworkMonitor", "unregisterNetworkCallback failed", e)
            }
        }
    }.distinctUntilChanged()
}
