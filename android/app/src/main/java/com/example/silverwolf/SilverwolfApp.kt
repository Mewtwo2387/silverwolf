package com.example.silverwolf

import android.app.Application
import android.util.Log
import com.example.silverwolf.data.SessionStore
import com.example.silverwolf.data.SilverwolfRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Process-wide singleton holding the data layer. Bridges the `silverwolf://login?session=`
 * deep link (emitted via [LoginSessionManager]) into the repository so the native screens
 * get an authenticated session. The legacy WebView path still sets its own cookie in parallel
 * during the migration — both consume the same [LoginSessionManager] broadcast.
 */
class SilverwolfApp : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    lateinit var sessionStore: SessionStore
        private set
    lateinit var repository: SilverwolfRepository
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
        repository = SilverwolfRepository(sessionStore)

        appScope.launch {
            LoginSessionManager.sessionFlow.collectLatest { token ->
                try {
                    repository.onLogin(token)
                } catch (e: Exception) {
                    Log.e("SilverwolfApp", "Native login handshake failed", e)
                }
            }
        }
    }
}
