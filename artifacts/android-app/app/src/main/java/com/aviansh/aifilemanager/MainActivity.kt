package com.aviansh.aifilemanager

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DriveFileMove
import androidx.compose.material.icons.filled.DriveFileRenameOutline
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Rule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.aviansh.aifilemanager.ui.theme.AIFileManagerTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.text.DateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AIFileManagerTheme {
                NativeFileManagerApp()
            }
        }
    }
}

private enum class Tab(val title: String, val icon: ImageVector) {
    Files("Files", Icons.Default.FolderOpen),
    Search("Search", Icons.Default.Search),
    Actions("Actions", Icons.Default.History),
    Snapshots("Snapshots", Icons.Default.Backup),
    Settings("Settings", Icons.Default.Settings),
}

private enum class EntryType { File, Directory }
private enum class OperationKind { Open, Rename, Copy, Move, Delete, Properties, Share, Select }
private enum class SearchMode { Both, Semantic, Filename }
private enum class TxStatus { Pending, Previewed, Completed, Failed, Reverted }
private enum class ActionType { Rename, Delete, Move, Copy, Create }

private data class FileEntry(
    val file: File,
    val name: String,
    val path: String,
    val type: EntryType,
    val size: Long,
    val modified: Long,
    val mimeType: String?,
)

private data class IgnoreRule(
    val line: Int,
    val pattern: String,
    val negated: Boolean,
    val directoryOnly: Boolean,
    val comment: Boolean = false,
    val empty: Boolean = false,
) {
    val label: String
        get() = when {
            empty -> "Empty line"
            comment -> "Comment"
            negated -> "Include $pattern"
            directoryOnly -> "Ignore folder $pattern"
            else -> "Ignore $pattern"
        }
}

private data class FileAction(
    val id: String,
    val type: ActionType,
    val target: File,
    val destination: File? = null,
    val content: String = "",
    val createDirectory: Boolean = false,
) {
    val risky: Boolean get() = type in listOf(ActionType.Rename, ActionType.Delete, ActionType.Move)
    val summary: String
        get() = when (type) {
            ActionType.Rename -> "Rename ${target.name} to ${destination?.name.orEmpty()}"
            ActionType.Delete -> "Delete ${target.name}"
            ActionType.Move -> "Move ${target.name} to ${destination?.path.orEmpty()}"
            ActionType.Copy -> "Copy ${target.name} to ${destination?.path.orEmpty()}"
            ActionType.Create -> "Create ${if (createDirectory) "folder" else "file"} ${target.name}"
        }
}

private data class SnapshotRecord(
    val id: String,
    val transactionId: String,
    val createdAt: Long,
    val affectedPaths: List<String>,
    val snapshotDir: File,
    val sizeBytes: Long,
)

private data class TransactionRecord(
    val id: String,
    val command: String,
    val summary: String,
    val actions: List<FileAction>,
    val status: TxStatus,
    val createdAt: Long,
    val snapshot: SnapshotRecord?,
    val error: String? = null,
)

private data class SearchResult(
    val entry: FileEntry,
    val score: Double,
    val matchType: String,
    val snippet: String,
)

private data class PreviewData(
    val title: String,
    val body: String,
    val imageBytes: ByteArray? = null,
    val unsupported: Boolean = false,
    val aiignoreRules: List<IgnoreRule> = emptyList(),
)

private class NativeFileRepository(private val context: Context) {
    val root: File = Environment.getExternalStorageDirectory()
    val snapshotRoot: File = File(context.filesDir, "transaction-snapshots").apply { mkdirs() }

    fun hasWholeStorageAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun entries(directory: File, rules: List<IgnoreRule>): List<FileEntry> {
        val files = directory.listFiles()?.toList().orEmpty()
        return files
            .filter { !isIgnored(it, rules) }
            .sortedWith(compareBy<File> { !it.isDirectory }.thenBy { it.name.lowercase(Locale.getDefault()) })
            .map { it.toEntry(root) }
    }

    fun createFolder(parent: File, name: String): Boolean = File(parent, name.sanitizedName()).mkdirs()

    fun createTextFile(parent: File, name: String, content: String = ""): Boolean {
        val target = File(parent, name.sanitizedName())
        if (target.exists()) return false
        target.parentFile?.mkdirs()
        target.writeText(content)
        return true
    }

    fun parseAiignore(): List<IgnoreRule> {
        val file = File(root, ".aiignore")
        if (!file.exists()) return emptyList()
        return file.readLines().mapIndexed { index, raw ->
            val trimmed = raw.trim()
            when {
                trimmed.isEmpty() -> IgnoreRule(index + 1, "", false, false, empty = true)
                trimmed.startsWith("#") -> IgnoreRule(index + 1, raw, false, false, comment = true)
                else -> {
                    val negated = trimmed.startsWith("!")
                    val pattern = trimmed.removePrefix("!").trim()
                    IgnoreRule(index + 1, pattern, negated, pattern.endsWith("/"))
                }
            }
        }
    }

    fun isIgnored(file: File, rules: List<IgnoreRule>): Boolean {
        if (rules.isEmpty()) return false
        val relative = file.relativeToOrSelf(root).invariantSeparatorsPath
        var ignored = false
        rules.filter { !it.comment && !it.empty }.forEach { rule ->
            if (matchesRule(relative, file.isDirectory, rule)) {
                ignored = !rule.negated
            }
        }
        return ignored
    }

    fun preview(file: File): PreviewData {
        if (file.isDirectory) {
            val count = file.list()?.size ?: 0
            return PreviewData(file.name, "Folder with $count item${if (count == 1) "" else "s"}")
        }
        if (file.name == ".aiignore") {
            val text = safeReadText(file)
            return PreviewData(file.name, text, aiignoreRules = parseAiignore())
        }
        if (isImageFile(file)) {
            return PreviewData(file.name, "Local image preview", imageBytes = file.readBytes())
        }
        if (isReadableText(file)) {
            return PreviewData(file.name, safeReadText(file))
        }
        return PreviewData(
            file.name,
            "No native preview is available for this file type.\n\n${formatBytes(file.length())} · ${mimeFor(file) ?: "unknown type"}",
            unsupported = true,
        )
    }

    private fun safeReadText(file: File): String {
        return runCatching {
            FileInputStream(file).buffered().reader(Charsets.UTF_8).use { reader ->
                val chars = CharArray(128 * 1024)
                val read = reader.read(chars)
                if (read <= 0) "" else chars.concatToString(0, read) + if (file.length() > read) "\n\n... preview truncated ..." else ""
            }
        }.getOrElse { "Unable to read file: ${it.message}" }
    }

    fun search(query: String, mode: SearchMode, rules: List<IgnoreRule>, limit: Int = 80): List<SearchResult> {
        if (query.isBlank()) return emptyList()
        val tokens = tokenize(query)
        return root.walkTopDown()
            .onEnter { dir -> !isIgnored(dir, rules) }
            .filter { it.isFile && !isIgnored(it, rules) }
            .take(2500)
            .mapNotNull { file ->
                val nameScore = scoreText(file.name, tokens)
                val content = if (mode != SearchMode.Filename && isReadableText(file) && file.length() < 512_000) safeReadText(file) else ""
                val contentScore = if (content.isNotBlank()) scoreText(content, tokens) else 0.0
                val score = when (mode) {
                    SearchMode.Filename -> nameScore
                    SearchMode.Semantic -> contentScore
                    SearchMode.Both -> maxOf(nameScore, contentScore)
                }
                if (score <= 0.0) null else {
                    val match = when {
                        nameScore > 0.0 && contentScore > 0.0 -> "both"
                        contentScore > nameScore -> "semantic"
                        else -> "filename"
                    }
                    SearchResult(file.toEntry(root), score.coerceAtMost(1.0), match, snippet(content, tokens))
                }
            }
            .sortedByDescending { it.score }
            .take(limit)
            .toList()
    }

    private fun scoreText(text: String, tokens: List<String>): Double {
        if (tokens.isEmpty()) return 0.0
        val lower = text.lowercase(Locale.getDefault())
        val hits = tokens.count { lower.contains(it) }
        val partial = tokens.count { token -> lower.split(Regex("\\W+")).any { it.contains(token) || token.contains(it) } }
        return ((hits * 1.0) + (partial * 0.35)) / tokens.size
    }

    private fun snippet(content: String, tokens: List<String>): String {
        if (content.isBlank()) return ""
        val lower = content.lowercase(Locale.getDefault())
        val index = tokens.map { lower.indexOf(it) }.filter { it >= 0 }.minOrNull() ?: 0
        val start = (index - 60).coerceAtLeast(0)
        val end = (index + 160).coerceAtMost(content.length)
        return content.substring(start, end).replace(Regex("\\s+"), " ").trim()
    }

    fun execute(command: String, actions: List<FileAction>): TransactionRecord {
        val txId = id("tx")
        val snapshot = createSnapshot(txId, actions)
        val completed = mutableListOf<FileAction>()
        return try {
            actions.forEach { action ->
                when (action.type) {
                    ActionType.Rename, ActionType.Move -> {
                        val dest = action.destination ?: error("Missing destination")
                        dest.parentFile?.mkdirs()
                        check(action.target.renameTo(dest)) { "Unable to move ${action.target.name}" }
                    }
                    ActionType.Copy -> {
                        val dest = action.destination ?: error("Missing destination")
                        copyRecursively(action.target, dest)
                    }
                    ActionType.Delete -> deleteRecursively(action.target)
                    ActionType.Create -> {
                        action.target.parentFile?.mkdirs()
                        if (action.createDirectory) action.target.mkdirs() else action.target.writeText(action.content)
                    }
                }
                completed.add(action)
            }
            TransactionRecord(txId, command, summarize(actions), actions, TxStatus.Completed, System.currentTimeMillis(), snapshot)
        } catch (e: Throwable) {
            restoreSnapshot(snapshot)
            TransactionRecord(txId, command, summarize(completed.ifEmpty { actions }), actions, TxStatus.Failed, System.currentTimeMillis(), snapshot, e.message)
        }
    }

    fun revert(transaction: TransactionRecord): Pair<TransactionRecord, Int> {
        val snapshot = transaction.snapshot ?: return transaction.copy(error = "No snapshot available") to 0
        val count = restoreSnapshot(snapshot)
        val createdTargets = transaction.actions.filter { it.type in listOf(ActionType.Copy, ActionType.Create) }.map { it.destination ?: it.target }
        createdTargets.forEach { target ->
            val wasSnapshotted = snapshot.affectedPaths.any { it == target.absolutePath }
            if (!wasSnapshotted && target.exists()) deleteRecursively(target)
        }
        return transaction.copy(status = TxStatus.Reverted) to count
    }

    private fun createSnapshot(txId: String, actions: List<FileAction>): SnapshotRecord {
        val dir = File(snapshotRoot, txId).apply { mkdirs() }
        val affected = actions.flatMap { action ->
            when (action.type) {
                ActionType.Copy, ActionType.Create -> listOfNotNull(action.destination ?: action.target).filter { it.exists() }
                else -> listOf(action.target)
            }
        }.distinctBy { it.absolutePath }
        affected.forEach { source ->
            if (source.exists()) copyRecursively(source, File(dir, hashPath(source.absolutePath)))
        }
        return SnapshotRecord(id("snap"), txId, System.currentTimeMillis(), affected.map { it.absolutePath }, dir, dir.folderSize())
    }

    fun restoreSnapshot(snapshot: SnapshotRecord): Int {
        var restored = 0
        snapshot.affectedPaths.forEach { originalPath ->
            val backup = File(snapshot.snapshotDir, hashPath(originalPath))
            if (backup.exists()) {
                val original = File(originalPath)
                if (original.exists()) deleteRecursively(original)
                copyRecursively(backup, original)
                restored++
            }
        }
        return restored
    }

    private fun copyRecursively(source: File, destination: File) {
        if (source.isDirectory) {
            destination.mkdirs()
            source.listFiles()?.forEach { copyRecursively(it, File(destination, it.name)) }
        } else {
            destination.parentFile?.mkdirs()
            FileInputStream(source).use { input ->
                FileOutputStream(destination).use { output -> input.copyTo(output) }
            }
        }
    }

    private fun deleteRecursively(file: File) {
        if (file.isDirectory) file.listFiles()?.forEach { deleteRecursively(it) }
        if (file.exists()) check(file.delete()) { "Unable to delete ${file.path}" }
    }

    fun parseCommand(command: String, currentDir: File): List<FileAction> {
        val text = command.trim()
        val lower = text.lowercase(Locale.getDefault())
        fun resolve(path: String): File {
            val clean = path.trim().trim('"', '\'')
            return if (clean.startsWith("/")) File(clean) else File(currentDir, clean)
        }
        return when {
            lower.startsWith("rename ") && lower.contains(" to ") -> {
                val parts = text.removePrefix("Rename ").removePrefix("rename ").split(Regex("\\s+to\\s+"), limit = 2)
                val target = resolve(parts[0])
                val dest = File(target.parentFile ?: currentDir, parts.getOrElse(1) { "" }.sanitizedName())
                listOf(FileAction(id("act"), ActionType.Rename, target, dest))
            }
            lower.startsWith("delete ") -> listOf(FileAction(id("act"), ActionType.Delete, resolve(text.substringAfter(" ", ""))))
            lower.startsWith("move ") && lower.contains(" to ") -> {
                val parts = text.removePrefix("Move ").removePrefix("move ").split(Regex("\\s+to\\s+"), limit = 2)
                val target = resolve(parts[0])
                val destBase = resolve(parts.getOrElse(1) { "" })
                val dest = if (destBase.extension.isBlank() || destBase.isDirectory) File(destBase, target.name) else destBase
                listOf(FileAction(id("act"), ActionType.Move, target, dest))
            }
            lower.startsWith("copy ") && lower.contains(" to ") -> {
                val parts = text.removePrefix("Copy ").removePrefix("copy ").split(Regex("\\s+to\\s+"), limit = 2)
                val target = resolve(parts[0])
                val destBase = resolve(parts.getOrElse(1) { "" })
                val dest = if (destBase.extension.isBlank() || destBase.isDirectory) File(destBase, target.name) else destBase
                listOf(FileAction(id("act"), ActionType.Copy, target, dest))
            }
            lower.startsWith("create ") -> {
                val name = text.substringAfter("called ", text.substringAfter("file ", text.substringAfter("create ")))
                listOf(FileAction(id("act"), ActionType.Create, resolve(name), content = ""))
            }
            else -> emptyList()
        }
    }

    private fun summarize(actions: List<FileAction>) = actions.joinToString("; ") { it.summary }
}

private class AppState(private val context: Context) {
    val repo = NativeFileRepository(context)
    var currentDir by mutableStateOf(repo.root)
    var entries by mutableStateOf<List<FileEntry>>(emptyList())
    var ignoreRules by mutableStateOf<List<IgnoreRule>>(emptyList())
    var selectedPaths = mutableStateListOf<String>()
    var transactions = mutableStateListOf<TransactionRecord>()
    var snapshots = mutableStateListOf<SnapshotRecord>()
    var permissionRefreshToken by mutableStateOf(0)
    var message by mutableStateOf<String?>(null)

    val hasPermission: Boolean get() = repo.hasWholeStorageAccess().also { permissionRefreshToken }
    val selectionMode: Boolean get() = selectedPaths.isNotEmpty()

    suspend fun refresh() = withContext(Dispatchers.IO) {
        val rules = repo.parseAiignore()
        val list = if (repo.hasWholeStorageAccess() && currentDir.exists()) repo.entries(currentDir, rules) else emptyList()
        withContext(Dispatchers.Main) {
            ignoreRules = rules
            entries = list
            selectedPaths.removeAll { selected -> list.none { it.path == selected } }
        }
    }

    fun navigateTo(dir: File) {
        if (dir.isDirectory) {
            currentDir = dir
            selectedPaths.clear()
        }
    }

    fun toggleSelection(file: File) {
        val path = file.absolutePath
        if (selectedPaths.contains(path)) selectedPaths.remove(path) else selectedPaths.add(path)
    }

    suspend fun perform(command: String, actions: List<FileAction>) = withContext(Dispatchers.IO) {
        val tx = repo.execute(command, actions)
        withContext(Dispatchers.Main) {
            transactions.add(0, tx)
            tx.snapshot?.let { snapshots.add(0, it) }
            selectedPaths.clear()
            message = if (tx.status == TxStatus.Completed) "Transaction complete. Snapshot created." else "Transaction failed: ${tx.error}"
        }
        refresh()
    }
}

@Composable
private fun NativeFileManagerApp() {
    val context = LocalContext.current
    val appState = remember { AppState(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(Tab.Files) }

    LaunchedEffect(appState.currentDir, appState.permissionRefreshToken) {
        appState.refresh()
    }

    appState.message?.let { message ->
        AlertDialog(
            onDismissRequest = { appState.message = null },
            confirmButton = { TextButton(onClick = { appState.message = null }) { Text("OK") } },
            text = { Text(message) },
        )
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.values().forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        icon = { Icon(item.icon, item.title) },
                        label = { Text(item.title) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                Tab.Files -> FilesScreen(appState, onOpenSettings = { tab = Tab.Settings })
                Tab.Search -> SearchScreen(appState)
                Tab.Actions -> TransactionsScreen(appState)
                Tab.Snapshots -> SnapshotsScreen(appState)
                Tab.Settings -> SettingsScreen(appState)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilesScreen(appState: AppState, onOpenSettings: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menuEntry by remember { mutableStateOf<FileEntry?>(null) }
    var previewFile by remember { mutableStateOf<File?>(null) }
    var showAi by remember { mutableStateOf(false) }
    var showCreate by remember { mutableStateOf(false) }
    var showCreateFolder by remember { mutableStateOf(false) }
    var pendingBulk by remember { mutableStateOf<ActionType?>(null) }

    Column(Modifier.fillMaxSize().padding(WindowInsets.statusBars.asPaddingValues())) {
        HeaderBar(
            title = if (appState.currentDir == appState.repo.root) "AI File Manager" else appState.currentDir.name,
            subtitle = appState.currentDir.absolutePath,
            leading = if (appState.currentDir != appState.repo.root) Icons.Default.ArrowBack else Icons.Default.AutoAwesome,
            onLeading = {
                if (appState.currentDir != appState.repo.root) appState.navigateTo(appState.currentDir.parentFile ?: appState.repo.root)
            },
            actions = {
                IconButton(onClick = { showCreate = true }) { Icon(Icons.Default.Add, "Create") }
                IconButton(onClick = { scope.launch { appState.refresh() } }) { Icon(Icons.Default.Refresh, "Refresh") }
                IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, "Settings") }
            },
        )

        if (!appState.hasPermission) {
            PermissionGate(appState)
            return@Column
        }

        if (appState.selectionMode) {
            SelectionBar(
                appState,
                onBulk = { pendingBulk = it },
                onShare = {
                    val files = appState.selectedPaths.map { File(it) }.filter { it.isFile }
                    if (files.isEmpty()) appState.message = "Only files can be shared."
                    else shareFiles(context, files)
                },
                onProperties = { pendingBulk = ActionType.Create },
            )
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = 88.dp),
        ) {
            if (appState.entries.isEmpty()) {
                item { EmptyState(Icons.Default.FolderOpen, "Empty directory", "No visible files in this folder") }
            }
            items(appState.entries, key = { it.path }) { entry ->
                FileRow(
                    entry = entry,
                    selected = appState.selectedPaths.contains(entry.path),
                    selectionMode = appState.selectionMode,
                    onOpen = {
                        if (appState.selectionMode) appState.toggleSelection(entry.file)
                        else if (entry.type == EntryType.Directory) appState.navigateTo(entry.file)
                        else previewFile = entry.file
                    },
                    onLong = {
                        appState.toggleSelection(entry.file)
                        menuEntry = entry
                    },
                    onMenu = { menuEntry = entry },
                )
                Divider()
            }
        }
    }

    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 72.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .clickable { showAi = true }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary)
        Text("Describe what to do with your files...", Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Icon(Icons.Default.Send, null, tint = MaterialTheme.colorScheme.primary)
    }

    menuEntry?.let { entry ->
        EntryMenu(
            entry = entry,
            onDismiss = { menuEntry = null },
            onAction = { kind ->
                menuEntry = null
                when (kind) {
                    OperationKind.Open -> if (entry.type == EntryType.Directory) appState.navigateTo(entry.file) else previewFile = entry.file
                    OperationKind.Select -> appState.toggleSelection(entry.file)
                    OperationKind.Properties -> previewFile = entry.file
                    OperationKind.Share -> shareFile(context, entry.file)
                    OperationKind.Delete -> scope.launch { appState.perform("Delete ${entry.name}", listOf(FileAction(id("act"), ActionType.Delete, entry.file))) }
                    OperationKind.Rename -> pendingBulk = ActionType.Rename.also { appState.selectedPaths.clear(); appState.selectedPaths.add(entry.path) }
                    OperationKind.Copy -> pendingBulk = ActionType.Copy.also { appState.selectedPaths.clear(); appState.selectedPaths.add(entry.path) }
                    OperationKind.Move -> pendingBulk = ActionType.Move.also { appState.selectedPaths.clear(); appState.selectedPaths.add(entry.path) }
                }
            },
        )
    }

    previewFile?.let { file ->
        PreviewSheet(file = file, appState = appState, onDismiss = { previewFile = null })
    }

    if (showAi) {
        AiCommandSheet(appState, prefill = "", onDismiss = { showAi = false })
    }

    if (showCreate) {
        CreateChoiceDialog(
            onDismiss = { showCreate = false },
            onFile = { showCreate = false; showCreateFolder = false; showCreate = false },
            onFolder = { showCreate = false; showCreateFolder = true },
            onCreateFile = { name ->
                scope.launch(Dispatchers.IO) {
                    appState.perform("Create $name", listOf(FileAction(id("act"), ActionType.Create, File(appState.currentDir, name.sanitizedName()))))
                }
            },
        )
    }

    if (showCreateFolder) {
        NameDialog("Create folder", "Folder name", onDismiss = { showCreateFolder = false }) { name ->
            scope.launch(Dispatchers.IO) {
                appState.perform(
                    "Create folder $name",
                    listOf(FileAction(id("act"), ActionType.Create, File(appState.currentDir, name.sanitizedName()), createDirectory = true)),
                )
            }
        }
    }

    pendingBulk?.let { action ->
        BulkActionDialog(appState, action, onDismiss = { pendingBulk = null })
    }
}

@Composable
private fun HeaderBar(
    title: String,
    subtitle: String,
    leading: ImageVector,
    onLeading: () -> Unit,
    actions: @Composable () -> Unit = {},
) {
    Row(
        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onLeading) { Icon(leading, null, tint = MaterialTheme.colorScheme.primary) }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        actions()
    }
}

@Composable
private fun PermissionGate(appState: AppState) {
    val context = LocalContext.current
    val legacyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        appState.permissionRefreshToken++
    }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.Security, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text("Storage access required", style = MaterialTheme.typography.titleLarge)
        Text(
            "AI File Manager needs local device storage access to browse, preview, and safely modify files. Access is requested only when you tap the button.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 12.dp),
        )
        Button(onClick = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val uri = Uri.parse("package:${context.packageName}")
                context.startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, uri))
            } else {
                legacyLauncher.launch(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE))
            }
        }) {
            Icon(Icons.Default.Security, null)
            Spacer(Modifier.width(8.dp))
            Text(if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) "Open Android Settings" else "Grant Storage Access")
        }
        TextButton(onClick = { appState.permissionRefreshToken++ }) { Text("I granted access") }
    }
}

@Composable
private fun SelectionBar(appState: AppState, onBulk: (ActionType) -> Unit, onShare: () -> Unit, onProperties: () -> Unit) {
    val allSelected = appState.entries.isNotEmpty() && appState.entries.all { appState.selectedPaths.contains(it.path) }
    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer).padding(10.dp)) {
        Text("${appState.selectedPaths.size} selected", fontWeight = FontWeight.SemiBold)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SmallAction("Select All", Icons.Default.SelectAll) {
                appState.selectedPaths.clear()
                appState.selectedPaths.addAll(appState.entries.map { it.path })
            }
            SmallAction("Deselect All", Icons.Default.Close) { appState.selectedPaths.clear() }
            SmallAction("Delete", Icons.Default.Delete) { onBulk(ActionType.Delete) }
            SmallAction("Move", Icons.Default.DriveFileMove) { onBulk(ActionType.Move) }
            SmallAction("Copy", Icons.Default.ContentCopy) { onBulk(ActionType.Copy) }
            SmallAction("Share", Icons.Default.Share) { onShare() }
            if (appState.selectedPaths.size == 1) SmallAction("Rename", Icons.Default.DriveFileRenameOutline) { onBulk(ActionType.Rename) }
            SmallAction("Properties", Icons.Default.Info) { onProperties() }
            SmallAction("Cancel", Icons.Default.Close) { appState.selectedPaths.clear() }
        }
        if (allSelected) Text("All visible items selected", style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun SmallAction(label: String, icon: ImageVector, onClick: () -> Unit) {
    AssistChip(onClick = onClick, label = { Text(label) }, leadingIcon = { Icon(icon, null, Modifier.size(16.dp)) })
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FileRow(
    entry: FileEntry,
    selected: Boolean,
    selectionMode: Boolean,
    onOpen: () -> Unit,
    onLong: () -> Unit,
    onMenu: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f) else Color.Transparent)
            .combinedClickable(onClick = onOpen, onLongClick = onLong)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (selectionMode) Checkbox(checked = selected, onCheckedChange = { onLong() })
        Icon(
            if (entry.type == EntryType.Directory) Icons.Default.Folder else iconFor(entry.name),
            null,
            Modifier.size(36.dp),
            tint = if (entry.type == EntryType.Directory) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary,
        )
        Column(Modifier.weight(1f)) {
            Text(entry.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
            Text(
                listOfNotNull(if (entry.type == EntryType.File) formatBytes(entry.size) else "folder", relativeDate(entry.modified)).joinToString(" · "),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        IconButton(onClick = onMenu) { Icon(Icons.Default.MoreVert, "Menu") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EntryMenu(entry: FileEntry, onDismiss: () -> Unit, onAction: (OperationKind) -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(entry.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(entry.path, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Divider(Modifier.padding(vertical = 8.dp))
            MenuButton("Open", Icons.Default.FolderOpen) { onAction(OperationKind.Open) }
            MenuButton("Rename", Icons.Default.DriveFileRenameOutline) { onAction(OperationKind.Rename) }
            MenuButton("Copy", Icons.Default.ContentCopy) { onAction(OperationKind.Copy) }
            MenuButton("Move", Icons.Default.DriveFileMove) { onAction(OperationKind.Move) }
            MenuButton("Delete", Icons.Default.Delete, danger = true) { onAction(OperationKind.Delete) }
            MenuButton("Properties", Icons.Default.Info) { onAction(OperationKind.Properties) }
            if (entry.type == EntryType.File) MenuButton("Share", Icons.Default.Share) { onAction(OperationKind.Share) }
            MenuButton("Select / add to selection", Icons.Default.SelectAll) { onAction(OperationKind.Select) }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun MenuButton(label: String, icon: ImageVector, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
        Icon(icon, null, tint = color)
        Text(label, color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun NameDialog(title: String, label: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var value by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { OutlinedTextField(value, { value = it }, label = { Text(label) }, singleLine = true) },
        confirmButton = { Button(onClick = { if (value.isNotBlank()) { onConfirm(value); onDismiss() } }) { Text("Apply") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun CreateChoiceDialog(
    onDismiss: () -> Unit,
    onFile: () -> Unit,
    onFolder: () -> Unit,
    onCreateFile: (String) -> Unit,
) {
    var fileName by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create item") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(fileName, { fileName = it }, label = { Text("File name") }, singleLine = true)
                OutlinedButton(onClick = onFolder, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Folder, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Create folder instead")
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (fileName.isNotBlank()) {
                    onCreateFile(fileName)
                    onFile()
                    onDismiss()
                }
            }) { Text("Create file") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun BulkActionDialog(appState: AppState, action: ActionType, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    val selected = appState.selectedPaths.map { File(it) }
    when (action) {
        ActionType.Delete -> ConfirmDialog(
            title = "Delete selected items?",
            body = "This will snapshot ${selected.size} item${if (selected.size == 1) "" else "s"} before deleting.",
            confirm = "Delete",
            danger = true,
            onDismiss = onDismiss,
        ) {
            scope.launch { appState.perform("Delete selected items", selected.map { FileAction(id("act"), ActionType.Delete, it) }) }
        }
        ActionType.Rename -> NameDialog("Rename item", "New name", onDismiss) { newName ->
            val file = selected.first()
            val dest = File(file.parentFile, newName.sanitizedName())
            scope.launch { appState.perform("Rename ${file.name} to $newName", listOf(FileAction(id("act"), ActionType.Rename, file, dest))) }
        }
        ActionType.Copy, ActionType.Move -> NameDialog(if (action == ActionType.Copy) "Copy to folder" else "Move to folder", "Destination path", onDismiss) { destPath ->
            val destBase = if (destPath.startsWith("/")) File(destPath) else File(appState.currentDir, destPath)
            val actions = selected.map { file ->
                FileAction(id("act"), action, file, File(destBase, file.name))
            }
            scope.launch { appState.perform("${action.name.lowercase()} selected items", actions) }
        }
        ActionType.Create -> {
            val file = selected.firstOrNull()
            if (file != null) PreviewSheet(file = file, appState = appState, onDismiss = onDismiss)
        }
    }
}

@Composable
private fun ConfirmDialog(title: String, body: String, confirm: String, danger: Boolean = false, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = {
            Button(
                colors = if (danger) ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error) else ButtonDefaults.buttonColors(),
                onClick = { onConfirm(); onDismiss() },
            ) { Text(confirm) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreviewSheet(file: File, appState: AppState, onDismiss: () -> Unit) {
    var preview by remember(file) { mutableStateOf<PreviewData?>(null) }
    LaunchedEffect(file) { preview = withContext(Dispatchers.IO) { appState.repo.preview(file) } }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState())) {
            Text(file.name, style = MaterialTheme.typography.titleLarge)
            Text(file.absolutePath, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            val data = preview
            if (data == null) {
                Text("Loading preview...")
            } else {
                data.imageBytes?.let { bytes ->
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()?.let { bitmap ->
                        Image(bitmap, null, Modifier.fillMaxWidth().height(260.dp).clip(RoundedCornerShape(8.dp)))
                    }
                } ?: Text(
                    data.body,
                    modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(12.dp),
                    fontFamily = if (!data.unsupported) FontFamily.Monospace else FontFamily.Default,
                )
                if (data.aiignoreRules.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Text("Parsed .aiignore rules", style = MaterialTheme.typography.titleMedium)
                    data.aiignoreRules.forEach { rule ->
                        Text("Line ${rule.line}: ${rule.label}", style = MaterialTheme.typography.bodySmall)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("Modified ${DateFormat.getDateTimeInstance().format(Date(file.lastModified()))} · ${formatBytes(file.length())}")
            }
            Spacer(Modifier.height(28.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AiCommandSheet(appState: AppState, prefill: String, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var command by remember { mutableStateOf(prefill) }
    var actions by remember { mutableStateOf<List<FileAction>>(emptyList()) }
    var parsed by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("AI Command", style = MaterialTheme.typography.titleLarge)
            Text("Rule-based local parser. File operations stay on this device.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = command,
                onValueChange = { command = it; parsed = false },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                label = { Text("Describe an action") },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Rename notes.txt to notes-old.txt", "Move report.md to Documents", "Delete temp.log").forEach { example ->
                    AssistChip(onClick = { command = example }, label = { Text(example, maxLines = 1) })
                }
            }
            Button(onClick = {
                actions = appState.repo.parseCommand(command, appState.currentDir)
                    .filterNot { appState.repo.isIgnored(it.target, appState.ignoreRules) }
                parsed = true
            }, enabled = command.isNotBlank()) {
                Icon(Icons.Default.AutoAwesome, null)
                Spacer(Modifier.width(8.dp))
                Text("Parse Command")
            }
            if (parsed) {
                if (actions.isEmpty()) {
                    Text("Could not parse this command. Try rename, copy, move, delete, or create.", color = MaterialTheme.colorScheme.error)
                } else {
                    Text("Action Plan Ready", fontWeight = FontWeight.SemiBold)
                    actions.forEach { ActionLine(it) }
                    Button(onClick = {
                        scope.launch { appState.perform(command, actions) }
                        onDismiss()
                    }) {
                        Icon(if (actions.any { it.risky }) Icons.Default.Warning else Icons.Default.CheckCircle, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (actions.any { it.risky }) "Approve & Execute" else "Execute")
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ActionLine(action: FileAction) {
    Row(
        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(iconForAction(action.type), null, tint = if (action.risky) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
        Column(Modifier.weight(1f)) {
            Text(action.summary, fontWeight = FontWeight.Medium)
            Text(if (action.risky) "RISKY · snapshot before commit" else "SAFE", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun SearchScreen(appState: AppState) {
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(SearchMode.Both) }
    var searching by remember { mutableStateOf(false) }
    var results by remember { mutableStateOf<List<SearchResult>>(emptyList()) }
    Column(Modifier.fillMaxSize().padding(WindowInsets.statusBars.asPaddingValues())) {
        HeaderBar("Search", "Local filename and content search", Icons.Default.Search, onLeading = {}) {}
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text("Search files by name or content") }, leadingIcon = { Icon(Icons.Default.Search, null) })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SearchMode.values().forEach { item ->
                    AssistChip(onClick = { mode = item }, label = { Text(item.name) }, leadingIcon = { if (mode == item) Icon(Icons.Default.CheckCircle, null, Modifier.size(16.dp)) })
                }
            }
            Button(onClick = {
                searching = true
                scope.launch {
                    results = withContext(Dispatchers.IO) { appState.repo.search(query, mode, appState.ignoreRules) }
                    searching = false
                }
            }, enabled = query.isNotBlank() && appState.hasPermission) { Text(if (searching) "Searching..." else "Search") }
        }
        LazyColumn(Modifier.weight(1f)) {
            if (results.isEmpty()) item { EmptyState(Icons.Default.Search, "No results", "Search stays local and skips .aiignore matches") }
            items(results, key = { it.entry.path }) { result ->
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(iconFor(result.entry.name), null, tint = MaterialTheme.colorScheme.primary)
                        Text(result.entry.name, Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text("${(result.score * 100).toInt()}% ${result.matchType}", style = MaterialTheme.typography.labelSmall)
                    }
                    Text(result.entry.path, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (result.snippet.isNotBlank()) Text(result.snippet, style = MaterialTheme.typography.bodySmall)
                }
                Divider()
            }
        }
    }
}

@Composable
private fun TransactionsScreen(appState: AppState) {
    val scope = rememberCoroutineScope()
    var revertTx by remember { mutableStateOf<TransactionRecord?>(null) }
    Column(Modifier.fillMaxSize().padding(WindowInsets.statusBars.asPaddingValues())) {
        HeaderBar("Action Log", "Review, approve, and revert file operations", Icons.Default.History, onLeading = {}) {}
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (appState.transactions.isEmpty()) item { EmptyState(Icons.Default.History, "No actions yet", "Use the command bar or file menus to perform operations") }
            items(appState.transactions, key = { it.id }) { tx ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(tx.status.name.uppercase(), color = statusColor(tx.status), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text("#${tx.id.takeLast(8)}", style = MaterialTheme.typography.labelSmall)
                        }
                        Text(tx.command, fontWeight = FontWeight.SemiBold)
                        Text(tx.summary, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("${tx.actions.size} action${if (tx.actions.size == 1) "" else "s"} · ${DateFormat.getDateTimeInstance().format(Date(tx.createdAt))}", style = MaterialTheme.typography.bodySmall)
                        if (tx.status == TxStatus.Completed && tx.snapshot != null) {
                            OutlinedButton(onClick = { revertTx = tx }) {
                                Icon(Icons.Default.Undo, null)
                                Spacer(Modifier.width(8.dp))
                                Text("Revert")
                            }
                        }
                    }
                }
            }
        }
    }
    revertTx?.let { tx ->
        ConfirmDialog("Revert transaction?", "Restore files from snapshot ${tx.snapshot?.id?.takeLast(8)}. This may overwrite current files.", "Revert", true, { revertTx = null }) {
            scope.launch(Dispatchers.IO) {
                val (updated, count) = appState.repo.revert(tx)
                withContext(Dispatchers.Main) {
                    val index = appState.transactions.indexOfFirst { it.id == tx.id }
                    if (index >= 0) appState.transactions[index] = updated
                    appState.message = "$count file${if (count == 1) "" else "s"} restored from snapshot."
                }
                appState.refresh()
            }
        }
    }
}

@Composable
private fun SnapshotsScreen(appState: AppState) {
    val scope = rememberCoroutineScope()
    var restoreSnapshot by remember { mutableStateOf<SnapshotRecord?>(null) }
    Column(Modifier.fillMaxSize().padding(WindowInsets.statusBars.asPaddingValues())) {
        HeaderBar("Snapshots", "Auto-created before every completed transaction", Icons.Default.Backup, onLeading = {}) {}
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (appState.snapshots.isEmpty()) item { EmptyState(Icons.Default.Backup, "No snapshots yet", "Snapshots appear after file operations complete") }
            items(appState.snapshots, key = { it.id }) { snap ->
                Card {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Backup, null, tint = MaterialTheme.colorScheme.secondary)
                            Spacer(Modifier.width(8.dp))
                            Text(DateFormat.getDateTimeInstance().format(Date(snap.createdAt)), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                            Text(formatBytes(snap.sizeBytes), style = MaterialTheme.typography.labelSmall)
                        }
                        Text("${snap.affectedPaths.size} affected item${if (snap.affectedPaths.size == 1) "" else "s"} · tx #${snap.transactionId.takeLast(8)}")
                        snap.affectedPaths.take(3).forEach { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        OutlinedButton(onClick = { restoreSnapshot = snap }) {
                            Icon(Icons.Default.Restore, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Restore")
                        }
                    }
                }
            }
        }
    }
    restoreSnapshot?.let { snap ->
        ConfirmDialog("Restore snapshot?", "This will overwrite affected files with the saved snapshot versions.", "Restore", true, { restoreSnapshot = null }) {
            scope.launch(Dispatchers.IO) {
                val count = appState.repo.restoreSnapshot(snap)
                withContext(Dispatchers.Main) { appState.message = "$count file${if (count == 1) "" else "s"} restored." }
                appState.refresh()
            }
        }
    }
}

@Composable
private fun SettingsScreen(appState: AppState) {
    var aiignoreText by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        aiignoreText = withContext(Dispatchers.IO) { File(appState.repo.root, ".aiignore").takeIf { it.exists() }?.readText().orEmpty() }
    }
    Column(Modifier.fillMaxSize().padding(WindowInsets.statusBars.asPaddingValues())) {
        HeaderBar("Settings", "Native Android diagnostics", Icons.Default.Settings, onLeading = {}) {}
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SettingsCard("File Access", Icons.Default.Security) {
                Text(if (appState.hasPermission) "Whole-device file access granted" else "Storage access denied or limited", fontWeight = FontWeight.SemiBold)
                Text("Root: ${appState.repo.root.absolutePath}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                PermissionGateCompact(appState)
            }
            SettingsCard("Search & Indexing", Icons.Default.Storage) {
                Text("Search scans local filenames and readable text files on demand.")
                Text(".aiignore rules loaded: ${appState.ignoreRules.count { !it.comment && !it.empty }}")
                Button(onClick = { scope.launch { appState.refresh() } }) { Text("Reload Folder and Rules") }
            }
            SettingsCard(".aiignore Rules", Icons.Default.Rule) {
                Text("Comments, empty lines, nested patterns, folder rules, and ! negation are parsed locally.")
                OutlinedTextField(aiignoreText, { aiignoreText = it }, Modifier.fillMaxWidth(), minLines = 8, textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        scope.launch(Dispatchers.IO) {
                            File(appState.repo.root, ".aiignore").writeText(aiignoreText)
                            appState.refresh()
                        }
                    }) { Text("Save & Apply") }
                    OutlinedButton(onClick = { aiignoreText += "\nnode_modules/\n*.log\n!important.log\n" }) { Text("Add Preset") }
                }
                appState.ignoreRules.take(20).forEach { Text("Line ${it.line}: ${it.label}", style = MaterialTheme.typography.bodySmall) }
            }
            SettingsCard("Transactions", Icons.Default.History) {
                Text("${appState.transactions.size} transactions · ${appState.snapshots.size} snapshots this session")
                Text("Snapshots are stored privately at ${appState.repo.snapshotRoot.absolutePath}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            SettingsCard("About", Icons.Default.Info) {
                Text("AI File Manager 1.0.0 native Android APK")
                Text("Expo-only permission assumptions removed. Local Android storage is the file source of truth.")
            }
        }
    }
}

@Composable
private fun PermissionGateCompact(appState: AppState) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                context.startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${context.packageName}")))
            }
        }) { Text("Open Access Settings") }
        OutlinedButton(onClick = { appState.permissionRefreshToken++ }) { Text("Refresh Status") }
    }
}

@Composable
private fun SettingsCard(title: String, icon: ImageVector, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            content()
        }
    }
}

@Composable
private fun EmptyState(icon: ImageVector, title: String, subtitle: String) {
    Column(
        Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun File.toEntry(root: File): FileEntry {
    return FileEntry(
        file = this,
        name = name.ifBlank { absolutePath },
        path = absolutePath,
        type = if (isDirectory) EntryType.Directory else EntryType.File,
        size = if (isFile) length() else 0L,
        modified = lastModified(),
        mimeType = mimeFor(this),
    )
}

private fun matchesRule(relativePath: String, isDirectory: Boolean, rule: IgnoreRule): Boolean {
    val pattern = rule.pattern.trim('/').replace("\\", "/")
    if (pattern.isBlank()) return false
    if (rule.directoryOnly && !isDirectory && !relativePath.contains("/${pattern.trimEnd('/')}")) return false
    val target = relativePath.trimStart('/')
    val regex = pattern
        .trimEnd('/')
        .split("/")
        .joinToString("/") { part ->
            part.replace(".", "\\.").replace("*", "[^/]*").replace("?", ".")
        }
        .let { if (pattern.contains("/")) Regex("(^|.*/)$it(/.*)?$") else Regex("(^|.*/)$it(/.*)?$") }
    return regex.containsMatchIn(target)
}

private fun isReadableText(file: File): Boolean {
    val name = file.name.lowercase(Locale.getDefault())
    val ext = file.extension.lowercase(Locale.getDefault())
    val textNames = setOf(".aiignore", ".gitignore", ".env", ".npmrc", ".editorconfig")
    val textExt = setOf("txt", "md", "json", "yaml", "yml", "xml", "log", "ini", "env", "aiignore", "gitignore", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "rs", "go", "php", "html", "css", "csv", "properties", "gradle", "kts", "kt")
    if (name in textNames || ext in textExt) return true
    if (file.length() > 1024 * 1024) return false
    return runCatching {
        FileInputStream(file).use { input ->
            val buffer = ByteArray(minOf(512, file.length().toInt().coerceAtLeast(0)))
            val read = input.read(buffer)
            read > 0 && buffer.take(read).none { it == 0.toByte() }
        }
    }.getOrDefault(false)
}

private fun isImageFile(file: File): Boolean = file.extension.lowercase(Locale.getDefault()) in setOf("png", "jpg", "jpeg", "webp")

private fun mimeFor(file: File): String? {
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase(Locale.getDefault()))
}

private fun iconFor(name: String): ImageVector {
    val ext = name.substringAfterLast('.', "").lowercase(Locale.getDefault())
    return when {
        name.startsWith(".") || ext in setOf("txt", "md", "json", "yaml", "yml", "xml", "ini", "env") -> Icons.Default.Description
        ext in setOf("js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "rs", "go", "php", "kt", "kts") -> Icons.Default.Terminal
        ext in setOf("png", "jpg", "jpeg", "webp") -> Icons.Default.Image
        else -> Icons.Default.Description
    }
}

private fun iconForAction(type: ActionType): ImageVector = when (type) {
    ActionType.Rename -> Icons.Default.DriveFileRenameOutline
    ActionType.Delete -> Icons.Default.Delete
    ActionType.Move -> Icons.Default.DriveFileMove
    ActionType.Copy -> Icons.Default.ContentCopy
    ActionType.Create -> Icons.Default.Add
}

private fun statusColor(status: TxStatus): Color = when (status) {
    TxStatus.Completed -> Color(0xFF2E7D32)
    TxStatus.Pending, TxStatus.Previewed -> Color(0xFF7B1FA2)
    TxStatus.Failed -> Color(0xFFC62828)
    TxStatus.Reverted -> Color(0xFF616161)
}

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return String.format(Locale.getDefault(), "%.1f KB", bytes / 1024.0)
    if (bytes < 1024 * 1024 * 1024) return String.format(Locale.getDefault(), "%.1f MB", bytes / 1024.0 / 1024.0)
    return String.format(Locale.getDefault(), "%.1f GB", bytes / 1024.0 / 1024.0 / 1024.0)
}

private fun relativeDate(time: Long): String {
    val diff = System.currentTimeMillis() - time
    return when {
        diff < 60_000 -> "just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        else -> DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(time))
    }
}

private fun tokenize(text: String): List<String> = text.lowercase(Locale.getDefault()).split(Regex("\\W+")).filter { it.length > 1 }

private fun File.folderSize(): Long = if (isFile) length() else listFiles()?.sumOf { it.folderSize() } ?: 0L

private fun hashPath(path: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(path.toByteArray())
    return digest.joinToString("") { "%02x".format(it) }
}

private fun id(prefix: String): String = "$prefix-${System.currentTimeMillis()}-${(1000..9999).random()}"

private fun String.sanitizedName(): String = trim().trim('/', '\\').ifBlank { "untitled" }

private fun shareFile(context: Context, file: File) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mimeFor(file) ?: "*/*"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Share ${file.name}"))
}

private fun shareFiles(context: Context, files: List<File>) {
    if (files.size == 1) {
        shareFile(context, files.first())
        return
    }
    val uris = ArrayList(files.map { FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", it) })
    val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "*/*"
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Share ${files.size} files"))
}
