package com.example.silverwolf

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object LoginSessionManager {
    private val _sessionFlow = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val sessionFlow: SharedFlow<String> = _sessionFlow.asSharedFlow()

    fun setSession(token: String) {
        _sessionFlow.tryEmit(token)
    }
}
