package com.example.silverwolf.ui.birthdays

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import com.example.silverwolf.data.BirthdayUser

private val MONTH_ORDER = listOf(
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)

@Composable
fun BirthdaysScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val app = context.applicationContext as SilverwolfApp
    val viewModel: BirthdaysViewModel = viewModel(factory = BirthdaysViewModel.Factory(app.repository))
    val state by viewModel.uiState.collectAsState()

    when (val s = state) {
        is BirthdaysUiState.Loading ->
            Column(modifier.fillMaxSize().wrapContentSize(Alignment.Center)) { CircularProgressIndicator() }

        is BirthdaysUiState.Error ->
            Column(
                modifier.fillMaxSize().wrapContentSize(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(s.message, style = MaterialTheme.typography.bodyMedium)
                Button(onClick = { viewModel.refresh() }) { Text("Retry") }
            }

        is BirthdaysUiState.Success -> {
            val months = MONTH_ORDER.filter { !s.byMonth[it].isNullOrEmpty() }
            if (months.isEmpty()) {
                Column(modifier.fillMaxSize().wrapContentSize(Alignment.Center)) {
                    Text("No birthdays recorded", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                LazyColumn(
                    modifier = modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    months.forEach { month ->
                        item(key = month) {
                            Text(
                                month,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                            )
                        }
                        items(
                            items = s.byMonth.getValue(month),
                            key = { "$month-${it.id}" },
                        ) { user -> BirthdayRowItem(user) }
                    }
                }
            }
        }
    }
}

@Composable
private fun BirthdayRowItem(user: BirthdayUser) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (user.avatarURL != null) {
            AsyncImage(
                model = user.avatarURL,
                contentDescription = null,
                modifier = Modifier.size(36.dp).clip(CircleShape),
            )
        }
        Column(Modifier.weight(1f)) {
            Text(user.username, style = MaterialTheme.typography.bodyLarge)
            Text(user.nextBirthday, style = MaterialTheme.typography.bodySmall)
        }
    }
}
