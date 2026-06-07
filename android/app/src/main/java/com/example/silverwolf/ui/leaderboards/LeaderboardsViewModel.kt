package com.example.silverwolf.ui.leaderboards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.silverwolf.data.LeaderboardResponse
import com.example.silverwolf.data.SilverwolfRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The four leaderboard boards exposed by `GET /api/leaderboards/:board`. */
enum class LeaderboardBoard(val id: String, val label: String) {
    GAMBLER("gambler", "Gambler"),
    MURDER("murder", "Murder"),
    NUGGIE("nuggie", "Nuggie"),
    POOP("poop", "Poop"),
}

sealed interface LeaderboardsUiState {
    data object Loading : LeaderboardsUiState
    data class Success(val result: LeaderboardResponse) : LeaderboardsUiState
    data class Error(val message: String) : LeaderboardsUiState
}

class LeaderboardsViewModel(private val repository: SilverwolfRepository) : ViewModel() {
    private val _selected = MutableStateFlow(LeaderboardBoard.GAMBLER)
    val selected: StateFlow<LeaderboardBoard> = _selected.asStateFlow()

    private val _uiState = MutableStateFlow<LeaderboardsUiState>(LeaderboardsUiState.Loading)
    val uiState: StateFlow<LeaderboardsUiState> = _uiState.asStateFlow()

    init {
        load(LeaderboardBoard.GAMBLER)
    }

    fun select(board: LeaderboardBoard) {
        if (_selected.value == board && _uiState.value is LeaderboardsUiState.Success) return
        _selected.value = board
        load(board)
    }

    fun retry() = load(_selected.value)

    private fun load(board: LeaderboardBoard) {
        viewModelScope.launch {
            _uiState.value = LeaderboardsUiState.Loading
            try {
                _uiState.value = LeaderboardsUiState.Success(repository.getLeaderboard(board.id))
            } catch (e: Exception) {
                _uiState.value = LeaderboardsUiState.Error(e.message ?: "Failed to load leaderboard")
            }
        }
    }

    class Factory(private val repository: SilverwolfRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            LeaderboardsViewModel(repository) as T
    }
}
