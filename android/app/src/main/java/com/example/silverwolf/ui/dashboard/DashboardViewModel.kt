package com.example.silverwolf.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.silverwolf.data.ProfileResponse
import com.example.silverwolf.data.SilverwolfRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data object LoggedOut : DashboardUiState
    data class Success(val profile: ProfileResponse) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}

class DashboardViewModel(private val repository: SilverwolfRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            val token = repository.isLoggedIn.first()
            if (token.isNullOrEmpty()) {
                _uiState.value = DashboardUiState.LoggedOut
                return@launch
            }
            try {
                _uiState.value = DashboardUiState.Success(repository.getProfile())
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(e.message ?: "Failed to load profile")
            }
        }
    }

    class Factory(private val repository: SilverwolfRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            DashboardViewModel(repository) as T
    }
}
