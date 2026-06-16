package com.example.silverwolf

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object LoginSessionManager {
    // replay = 1 so a token emitted from a cold-start deep link (handleDeepLink
    // runs before setContent, i.e. before MainScreen's collector subscribes) is
    // retained and delivered once the UI subscribes, instead of being dropped.
    private val _sessionFlow = MutableSharedFlow<String>(replay = 1)
    val sessionFlow: SharedFlow<String> = _sessionFlow.asSharedFlow()

    fun setSession(token: String) {
        _sessionFlow.tryEmit(token)
    }
}
