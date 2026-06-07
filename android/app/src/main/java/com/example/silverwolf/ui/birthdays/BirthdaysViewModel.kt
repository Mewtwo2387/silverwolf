package com.example.silverwolf.ui.birthdays

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.silverwolf.data.BirthdayUser
import com.example.silverwolf.data.SilverwolfRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface BirthdaysUiState {
    data object Loading : BirthdaysUiState
    data class Success(val byMonth: Map<String, List<BirthdayUser>>) : BirthdaysUiState
    data class Error(val message: String) : BirthdaysUiState
}

class BirthdaysViewModel(private val repository: SilverwolfRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<BirthdaysUiState>(BirthdaysUiState.Loading)
    val uiState: StateFlow<BirthdaysUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = BirthdaysUiState.Loading
            try {
                _uiState.value = BirthdaysUiState.Success(repository.getBirthdays())
            } catch (e: Exception) {
                _uiState.value = BirthdaysUiState.Error(e.message ?: "Failed to load birthdays")
            }
        }
    }

    class Factory(private val repository: SilverwolfRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            BirthdaysViewModel(repository) as T
    }
}
