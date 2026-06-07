package com.example.silverwolf.ui.leaderboards

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.silverwolf.SilverwolfApp
import com.example.silverwolf.data.LeaderboardRow

@Composable
fun LeaderboardsScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val app = context.applicationContext as SilverwolfApp
    val viewModel: LeaderboardsViewModel = viewModel(factory = LeaderboardsViewModel.Factory(app.repository))
    val selected by viewModel.selected.collectAsState()
    val state by viewModel.uiState.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        ScrollableTabRow(selectedTabIndex = selected.ordinal, edgePadding = 12.dp) {
            LeaderboardBoard.entries.forEach { board ->
                Tab(
                    selected = board == selected,
                    onClick = { viewModel.select(board) },
                    text = { Text(board.label) },
                )
            }
        }

        when (val s = state) {
            is LeaderboardsUiState.Loading ->
                Column(Modifier.fillMaxSize().wrapContentSize(Alignment.Center)) { CircularProgressIndicator() }

            is LeaderboardsUiState.Error ->
                Column(
                    Modifier.fillMaxSize().wrapContentSize(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(s.message, style = MaterialTheme.typography.bodyMedium)
                    Button(onClick = { viewModel.retry() }) { Text("Retry") }
                }

            is LeaderboardsUiState.Success -> {
                val rows = s.result.rows
                if (rows.isEmpty()) {
                    Column(Modifier.fillMaxSize().wrapContentSize(Alignment.Center)) {
                        Text("No entries yet", style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        item {
                            Text(
                                s.result.title,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp),
                            )
                        }
                        items(rows) { row -> LeaderboardRowItem(row) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardRowItem(row: LeaderboardRow) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "#${row.rank}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.width(40.dp),
            )
            if (row.avatarURL != null) {
                AsyncImage(
                    model = row.avatarURL,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp).clip(CircleShape),
                )
            }
            Text(row.username, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Text(
                row.valueLabel,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
        }
        HorizontalDivider()
    }
}
