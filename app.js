// ============================================
// SONATA 2.0 - Music App with IndexedDB
// ============================================

// IndexedDB Configuration
const DB_NAME = "SONATA_DB"
const DB_VERSION = 1
const SONGS_STORE = "songs"
const PLAYLISTS_STORE = "playlists"

let db = null
let songs = []
let playlists = []
let currentSongIndex = 0
let isPlaying = false
let selectedPlaylistId = null
let currentGenre = ""
let currentMood = ""
let currentTime = ""
let pendingUploadFiles = [] // Changed to array for multi-upload
let songToEditId = null
let favorites = [] // New: Favorites list
let searchTerm = "" // New: Search term
let showOnlyFavorites = false // New: Favorites filter toggle
let isShuffle = false // New: Shuffle state
let shuffledQueue = [] // New: Shuffled queue

// New: Toast Notification Helper
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container")
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : "!"}</span>
        <span class="toast-message">${message}</span>
    `
  container.appendChild(toast)

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease forwards"
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

const genres = [
  { id: "classical", name: "Klassik", emoji: "🎻" },
  { id: "jazz", name: "Jazz", emoji: "🎷" },
  { id: "rock", name: "Rock", emoji: "🎸" },
  { id: "pop", name: "Pop", emoji: "🎤" },
  { id: "electronic", name: "Electronic", emoji: "🎛️" },
  { id: "hiphop", name: "Hip-Hop", emoji: "🎧" },
  { id: "blues", name: "Blues", emoji: "🎹" },
  { id: "metal", name: "Metal", emoji: "🤘" },
  { id: "reggae", name: "Reggae", emoji: "🌴" },
  { id: "country", name: "Country", emoji: "🤠" },
]

const moods = ["Energisch", "Entspannt", "Fokussiert", "Party", "Melancholisch", "Euphorisch"]
const times = ["Morgens", "Mittags", "Abends", "Nachts"]

// ============================================
// IndexedDB Initialization
// ============================================
async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        db.createObjectStore(SONGS_STORE, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: "id" })
      }
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
  })
}

// ============================================
// Database Operations
// ============================================
async function getSongsFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SONGS_STORE], "readonly")
    const store = transaction.objectStore(SONGS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function getPlaylistsFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLISTS_STORE], "readonly")
    const store = transaction.objectStore(PLAYLISTS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function saveSongToDB(song) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SONGS_STORE], "readwrite")
    const store = transaction.objectStore(SONGS_STORE)
    const request = store.put(song)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function deleteSongFromDB(songId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SONGS_STORE], "readwrite")
    const store = transaction.objectStore(SONGS_STORE)
    const request = store.delete(songId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function savePlaylistToDB(playlist) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLISTS_STORE], "readwrite")
    const store = transaction.objectStore(PLAYLISTS_STORE)
    const request = store.put(playlist)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function deletePlaylistFromDB(playlistId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYLISTS_STORE], "readwrite")
    const store = transaction.objectStore(PLAYLISTS_STORE)
    const request = store.delete(playlistId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function clearAllDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SONGS_STORE, PLAYLISTS_STORE], "readwrite")

    const songsRequest = transaction.objectStore(SONGS_STORE).clear()
    const playlistsRequest = transaction.objectStore(PLAYLISTS_STORE).clear()

    songsRequest.onerror = () => reject(songsRequest.error)
    playlistsRequest.onerror = () => reject(playlistsRequest.error)

    transaction.oncomplete = () => resolve()
  })
}

// ============================================
// Initialize App
// ============================================
async function init() {
  try {
    await initDatabase()
    await loadData()
    await migrateSongsForStatistics() // Migrate old songs
    setupFileInput()
    setupAudioListener()
    setupVolumeControl()
    renderSongs()
    renderPlaylists()
    setupGenreButtons()
    setupMoodButtons()
    setupTimeButtons()
    updateStorageInfo()
    setupSearch() // New
    setupKeyboardShortcuts() // New
  } catch (error) {
    console.error("Fehler beim Initialisieren der App:", error)
    showToast("Fehler beim Laden der Datenbank", "error")
  }
}

// ============================================
// Data Loading
// ============================================
async function loadData() {
  try {
    songs = await getSongsFromDB()
    playlists = await getPlaylistsFromDB()
  } catch (error) {
    console.error("Fehler beim Laden von Daten:", error)
  }
}

// ============================================
// File Upload Handling
// ============================================
function setupFileInput() {
  const fileInput = document.getElementById("file-input")
  fileInput.addEventListener("change", handleFileSelect)

  // Drag and drop
  const uploadZone = document.querySelector(".upload-zone")
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault()
    uploadZone.style.background = "rgba(212, 175, 55, 0.12)"
  })

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.style.background = "rgba(212, 175, 55, 0.06)"
  })

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault()
    uploadZone.style.background = "rgba(212, 175, 55, 0.06)"
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  })
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  processFiles(files)
  e.target.value = ""
}

function processFiles(files) {
  const audioFiles = files.filter((f) => f.type.startsWith("audio/"))
  if (audioFiles.length === 0) {
    showToast("Bitte nur Audiodateien auswählen", "error")
    return
  }

  // Store all files and open modal once
  pendingUploadFiles = audioFiles
  openUploadModal()
}

// Render playlist selector with multi-select support
function renderPlaylistSelector(containerId) {
  const container = document.getElementById(containerId)

  if (playlists.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine Playlists vorhanden</div>'
    return
  }

  const sortedPlaylists = [...playlists].sort((a, b) => a.name.localeCompare(b.name))

  container.innerHTML = sortedPlaylists
    .map(p => {
      const genre = genres.find(g => g.id === p.genre)
      return `
        <div class="playlist-option" data-playlist-id="${p.id}" onclick="togglePlaylistSelection(this)">
          ${p.name} (${genre?.emoji || "🎵"} ${genre?.name || "Unbekannt"})
        </div>
      `
    })
    .join("")
}

// Toggle playlist selection for multi-select
function togglePlaylistSelection(el) {
  el.classList.toggle("selected")
}

function openUploadModal() {
  if (pendingUploadFiles.length === 0) return

  const nameInput = document.getElementById("song-name-input")

  if (pendingUploadFiles.length > 1) {
    nameInput.value = `${pendingUploadFiles.length} Dateien ausgewählt`
    nameInput.disabled = true
    nameInput.placeholder = "Namen werden von Dateien übernommen"
  } else {
    nameInput.value = pendingUploadFiles[0].name.replace(/\.[^/.]+$/, "")
    nameInput.disabled = false
    nameInput.placeholder = "Song Name eingeben"
  }

  renderPlaylistSelector("upload-playlist-selector")
  document.getElementById("upload-modal").classList.add("active")
}

// Helper to read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

async function confirmUpload() {
  if (pendingUploadFiles.length === 0) return

  const nameInput = document.getElementById("song-name-input")
  const singleName = nameInput.value.trim()

  // Validation only for single file if user cleared the input
  if (pendingUploadFiles.length === 1 && !singleName) {
    showToast("Bitte einen Song-Namen eingeben", "error")
    return
  }

  try {
    // Collect all selected playlists (multi-select support)
    const selectedPlaylists = document.querySelectorAll("#upload-playlist-selector .playlist-option.selected")
    const selectedPlaylistIds = Array.from(selectedPlaylists).map(el => el.dataset.playlistId)

    let successCount = 0

    // Process all files
    for (const file of pendingUploadFiles) {
      try {
        const buffer = await readFileAsArrayBuffer(file)

        // Use manual name for single file, or filename for multiple
        const songName = (pendingUploadFiles.length === 1) ? singleName : file.name.replace(/\.[^/.]+$/, "")

        const song = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // Ensure unique ID
          name: songName,
          data: buffer,
          type: file.type,
          playlistId: null,
          dateAdded: new Date().toISOString(),
          size: file.size,
        }

        // TRANSACTIONAL: First save song to DB
        await saveSongToDB(song)
        songs.push(song)

        // TRANSACTIONAL: Add to playlists
        if (selectedPlaylistIds.length > 0) {
          for (const playlistId of selectedPlaylistIds) {
            const playlist = playlists.find(p => p.id === playlistId)
            if (playlist) {
              // DUPLICATE PREVENTION
              if (!playlist.songs.includes(song.id)) {
                playlist.songs.push(song.id)
                await savePlaylistToDB(playlist)
              }
            }
          }
        }
        successCount++
      } catch (err) {
        console.error(`Fehler bei Datei ${file.name}:`, err)
      }
    }

    renderSongs()
    renderPlaylists()
    closeModal("upload-modal")
    pendingUploadFiles = []
    nameInput.value = ""
    nameInput.disabled = false // Reset disabled state
    updateStorageInfo()

    if (successCount > 0) {
      const playlistMsg = selectedPlaylistIds.length > 0 ? ` in ${selectedPlaylistIds.length} Playlists` : ""
      showToast(`${successCount} Song(s) erfolgreich hochgeladen${playlistMsg}`)
    } else {
      showToast("Fehler beim Upload", "error")
    }

  } catch (error) {
    console.error("Fehler beim Upload-Prozess:", error)
    showToast("Fehler beim Upload der Dateien", "error")
  }
}

// ============================================
// Statistics Migration & Tracking
// ============================================
async function migrateSongsForStatistics() {
  let updated = false

  for (const song of songs) {
    if (song.playCount === undefined) {
      song.playCount = 0
      song.lastPlayed = null
      await saveSongToDB(song)
      updated = true
    }
  }

  if (updated) {
    console.log("Songs migrated with statistics fields")
  }
}

async function updateSongStatistics(songId) {
  const song = songs.find(s => s.id === songId)
  if (song) {
    song.playCount = (song.playCount || 0) + 1
    song.lastPlayed = new Date().toISOString()

    try {
      await saveSongToDB(song)
      updateStatisticsDisplay()
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Statistiken:", error)
    }
  }
}

function updateStatisticsDisplay() {
  const statsSection = document.getElementById("statistics-section")
  if (!statsSection || !statsSection.classList.contains("active")) return

  renderMostPlayedSongs()
  renderRecentlyPlayed()
  renderListeningTrends()
}

// ============================================
function openCreatePlaylistModal() {
  currentGenre = ""
  currentMood = ""
  currentTime = ""
  document.getElementById("playlist-name-input").value = ""
  renderGenreButtons()
  renderMoodButtons()
  renderTimeButtons()
  document.getElementById("create-playlist-modal").classList.add("active")
}

function setupGenreButtons() {
  renderGenreButtons()
}

function renderGenreButtons() {
  const container = document.getElementById("genre-buttons")
  container.innerHTML = genres
    .map(
      (g) => `
        <button class="genre-btn" data-genre="${g.id}" onclick="selectGenre('${g.id}', this)">
            ${g.emoji} ${g.name}
        </button>
    `,
    )
    .join("")
}

function selectGenre(genreId, el) {
  document.querySelectorAll(".genre-btn").forEach((b) => b.classList.remove("selected"))
  el.classList.add("selected")
  currentGenre = genreId
}

function setupMoodButtons() {
  renderMoodButtons()
}

function renderMoodButtons() {
  const container = document.getElementById("mood-buttons")
  container.innerHTML = moods
    .map(
      (m) => `
        <button class="mood-btn" data-mood="${m}" onclick="selectMood('${m}', this)">${m}</button>
    `,
    )
    .join("")
}

function selectMood(mood, el) {
  document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"))
  el.classList.add("selected")
  currentMood = mood
}

function setupTimeButtons() {
  renderTimeButtons()
}

function renderTimeButtons() {
  const container = document.getElementById("time-buttons")
  container.innerHTML = times
    .map(
      (t) => `
        <button class="time-btn" data-time="${t}" onclick="selectTime('${t}', this)">${t}</button>
    `,
    )
    .join("")
}

function selectTime(time, el) {
  document.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("selected"))
  el.classList.add("selected")
  currentTime = time
}

async function createPlaylist() {
  const name = document.getElementById("playlist-name-input").value.trim()

  if (!name || !currentGenre) {
    showToast("Bitte Name und Musikrichtung auswählen", "error")
    return
  }

  const playlist = {
    id: Date.now().toString(),
    name: name,
    genre: currentGenre,
    mood: currentMood,
    time: currentTime,
    songs: [],
    dateCreated: new Date().toISOString(),
  }

  try {
    await savePlaylistToDB(playlist)
    playlists.push(playlist)
    renderPlaylists()
    closeModal("create-playlist-modal")
    showToast("Playlist erstellt")
  } catch (error) {
    console.error("Fehler beim Erstellen der Playlist:", error)
    showToast("Fehler beim Erstellen der Playlist", "error")
  }
}

function renderPlaylists() {
  const container = document.getElementById("playlists-grid")

  if (playlists.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine Playlists vorhanden</div>'
    return
  }

  const sorted = [...playlists].sort((a, b) => a.name.localeCompare(b.name))

  container.innerHTML = sorted
    .map((p) => {
      const genre = genres.find((g) => g.id === p.genre)
      return `
            <div class="playlist-card" onclick="openPlaylistDetail('${p.id}')">
                <div class="playlist-image">${genre?.emoji || "🎵"}</div>
                <div class="playlist-info">
                    <div class="playlist-name">${p.name}</div>
                    <div class="playlist-meta">${p.songs.length} Songs • ${genre?.name || "Unbekannt"}</div>
                </div>
            </div>
        `
    })
    .join("")
}

function openPlaylistDetail(playlistId) {
  selectedPlaylistId = playlistId
  renderPlaylistDetail()
  switchSection("playlist-detail-section")
}

function renderPlaylistDetail() {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  if (!playlist) return

  const genre = genres.find((g) => g.id === playlist.genre)
  const songCount = playlist.songs.filter((songId) => songs.find((s) => s.id === songId)).length

  const detailHTML = `
        <div class="detail-header">
            <div class="detail-image">${genre?.emoji || "🎵"}</div>
            <div class="detail-text">
                <h3>${playlist.name}</h3>
                <p>${songCount} Songs • ${genre?.name || "Unbekannt"}</p>
            </div>
        </div>
        <button class="playlist-action-btn play" onclick="playPlaylist()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
            Playlist abspielen
        </button>
        <button class="playlist-action-btn add" onclick="openAddSongsModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Songs hinzufügen
        </button>
        <button class="playlist-action-btn delete" onclick="deletePlaylist()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Playlist löschen
        </button>
    `

  document.getElementById("playlist-detail-container").innerHTML = detailHTML
  renderPlaylistSongs()
}

// Delete playlist function
async function deletePlaylist() {
  if (!confirm("Playlist wirklich löschen?")) return

  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  if (!playlist) return

  try {
    await deletePlaylistFromDB(selectedPlaylistId)
    playlists = playlists.filter((p) => p.id !== selectedPlaylistId)
    selectedPlaylistId = null
    showToast("Playlist gelöscht")
    switchSection("playlists-section")
    renderPlaylists()
  } catch (error) {
    console.error("Fehler beim Löschen der Playlist:", error)
    showToast("Fehler beim Löschen der Playlist", "error")
  }
}

function renderPlaylistSongs() {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  const container = document.getElementById("playlist-songs-list")

  if (!playlist || playlist.songs.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine Songs in dieser Playlist</div>'
    return
  }

  const sortedSongs = playlist.songs
    .map((songId) => songs.find((s) => s.id === songId))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (sortedSongs.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine Songs in dieser Playlist</div>'
    return
  }

  container.innerHTML = sortedSongs
    .map(
      (song) => `
        <div class="song-card">
            <div class="song-info">
                <div class="song-name">${song.name}</div>
                <div class="song-meta">${new Date(song.dateAdded).toLocaleDateString("de-DE")}</div>
            </div>
            <div class="song-actions">
                <button class="btn-small ${song.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${song.id}')">
                    ${song.isFavorite ? '❤️' : '🤍'}
                </button>
                <button class="btn-small" onclick="playSongFromPlaylist('${song.id}')">▶</button>
                <button class="btn-small" onclick="editSong('${song.id}')">✏️</button>
                <button class="btn-small btn-danger" onclick="removeSongFromPlaylist('${song.id}')">✕</button>
            </div>
        </div>
    `,
    )
    .join("")
}

function openAddSongsModal() {
  renderPlaylistSongSelector()
  document.getElementById("add-to-playlist-modal").classList.add("active")
}

function renderPlaylistSongSelector() {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  const availableSongs = songs
    .filter((s) => !playlist.songs.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const container = document.getElementById("add-playlist-selector")

  if (availableSongs.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine verfügbaren Songs</div>'
    return
  }

  container.innerHTML = availableSongs
    .map(
      (s) => `
        <div class="playlist-option" data-song-id="${s.id}" onclick="toggleSongSelection(this)">
            ${s.name}
        </div>
    `,
    )
    .join("")
}

function toggleSongSelection(el) {
  el.classList.toggle("selected")
}

async function confirmAddToPlaylist() {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  const selected = document.querySelectorAll("#add-playlist-selector .playlist-option.selected")

  selected.forEach((el) => {
    const songId = el.dataset.songId
    if (!playlist.songs.includes(songId)) {
      playlist.songs.push(songId)
    }
  })

  try {
    await savePlaylistToDB(playlist)
    renderPlaylistDetail()
    closeModal("add-to-playlist-modal")
    showToast("Songs hinzugefügt")
  } catch (error) {
    console.error("Fehler beim Hinzufügen von Songs:", error)
    showToast("Fehler beim Hinzufügen von Songs", "error")
  }
}

async function removeSongFromPlaylist(songId) {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  playlist.songs = playlist.songs.filter((id) => id !== songId)

  try {
    await savePlaylistToDB(playlist)
    renderPlaylistDetail()
    showToast("Song entfernt")
  } catch (error) {
    console.error("Fehler beim Entfernen des Songs:", error)
    showToast("Fehler beim Entfernen des Songs", "error")
  }
}

function backToPlaylists() {
  selectedPlaylistId = null
  switchSection("playlists-section")
}

// ============================================
// Player Functions
// ============================================
function renderSongs() {
  const container = document.getElementById("songs-list")

  // Filter songs based on search term and favorites filter
  let filteredSongs = songs.filter(song =>
    song.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Apply favorites filter if active
  if (showOnlyFavorites) {
    filteredSongs = filteredSongs.filter(song => song.isFavorite)
  }

  if (filteredSongs.length === 0) {
    const message = showOnlyFavorites ? 'Keine Favoriten gefunden' : 'Keine Songs gefunden'
    container.innerHTML = `<div class="empty-message">${message}</div>`
    return
  }

  const sortedSongs = [...filteredSongs].sort((a, b) => a.name.localeCompare(b.name))

  container.innerHTML = sortedSongs
    .map((song) => {
      const playlist = playlists.find((p) => p.id === song.playlistId)
      return `
            <div class="song-card ${currentSongIndex !== -1 && songs[currentSongIndex]?.id === song.id ? 'playing' : ''}">
                <div class="song-info">
                    <div class="song-name">${song.name}</div>
                    <div class="song-meta">${playlist ? `Playlist: ${playlist.name}` : "Keine Playlist"}</div>
                </div>
                <div class="song-actions">
                    <button class="btn-small ${song.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${song.id}')">
                        ${song.isFavorite ? '❤️' : '🤍'}
                    </button>
                    <button class="btn-small" onclick="playSongFromList('${song.id}')">▶</button>
                    <button class="btn-small" onclick="editSong('${song.id}')">✏️</button>
                    <button class="btn-small btn-danger" onclick="deleteSong('${song.id}')">✕</button>
                </div>
            </div>
        `
    })
    .join("")
}

// Toggle favorites filter
function toggleFavoritesFilter() {
  showOnlyFavorites = !showOnlyFavorites
  const btn = document.getElementById("favorites-filter-btn")
  if (showOnlyFavorites) {
    btn.classList.add("active")
  } else {
    btn.classList.remove("active")
  }
  renderSongs()
}

// New: Search Setup
function setupSearch() {
  const searchInput = document.getElementById("search-input")
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value
    renderSongs()
  })
}

// New: Favorites Logic
async function toggleFavorite(songId) {
  const song = songs.find(s => s.id === songId)
  if (song) {
    song.isFavorite = !song.isFavorite
    try {
      await saveSongToDB(song)
      renderSongs()
      if (selectedPlaylistId) renderPlaylistSongs()
      showToast(song.isFavorite ? "Zu Favoriten hinzugefügt" : "Aus Favoriten entfernt")
    } catch (error) {
      console.error("Fehler beim Speichern des Favoriten:", error)
      showToast("Fehler beim Speichern", "error")
    }
  }
}

// New: Shuffle Logic
function toggleShuffle() {
  isShuffle = !isShuffle
  const btn = document.getElementById("shuffle-btn")
  if (isShuffle) {
    btn.classList.add("active")
    generateShuffledQueue()
    showToast("Zufallswiedergabe an")
  } else {
    btn.classList.remove("active")
    shuffledQueue = []
    showToast("Zufallswiedergabe aus")
  }
}

function generateShuffledQueue() {
  // Create a shuffled list of indices from the current context (songs array)
  let indices = songs.map((_, index) => index)
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  shuffledQueue = indices
}

// New: Player Favorite Logic
async function toggleCurrentFavorite() {
  if (currentSongIndex === -1 || !songs[currentSongIndex]) return

  const song = songs[currentSongIndex]
  await toggleFavorite(song.id)
  updatePlayerFavoriteUI()
}

function updatePlayerFavoriteUI() {
  const btn = document.getElementById("player-favorite-btn")
  if (!btn) return

  if (currentSongIndex !== -1 && songs[currentSongIndex]?.isFavorite) {
    btn.classList.add("active")
    btn.querySelector("svg").style.fill = "currentColor"
  } else {
    btn.classList.remove("active")
    btn.querySelector("svg").style.fill = "none"
  }
}

// Vinyl Animation Helper
function updateVinylAnimation(playing) {
  const record = document.getElementById("vinyl-record")
  const tonearm = document.getElementById("tonearm")

  if (playing) {
    record.classList.add("spinning")
    tonearm.classList.add("playing")
  } else {
    record.classList.remove("spinning")
    // Keep tonearm on record if paused, or move back?
    // User wanted "realistic". Real players keep arm on record when paused (usually).
    // But for visual feedback, let's keep it "playing" state (on record) but stop spin.
    // If we want to simulate "Stop", we would remove the class.
    // For now, let's keep it simple: if playing, arm is on. If paused, arm stays on?
    // Actually, if I remove .playing class, it rotates back.
    // Let's make it rotate back only when stopped (which we don't have) or maybe just keep it?
    // Let's keep it on the record if we are just paused.
    // But standard UI behavior: pause -> stop animation.
    // If I remove .playing, it goes back. Let's try that for now.
    tonearm.classList.remove("playing")
  }
}

// Override playSong to handle shuffle and UI updates
function playSong() {
  if (currentSongIndex === -1 || !songs[currentSongIndex]) return

  const song = songs[currentSongIndex]
  const audioPlayer = document.getElementById("audio-player")

  // Create Blob URL if needed (for IndexedDB stored files)
  // Note: In a real app with large files, we might need to handle Blob URLs carefully to avoid memory leaks
  // For this demo, we assume song.data is an ArrayBuffer
  const blob = new Blob([song.data], { type: song.type })
  const url = URL.createObjectURL(blob)

  audioPlayer.src = url
  audioPlayer.play()
    .then(() => {
      isPlaying = true
      updatePlayButton()
      updatePlayerInfo()
      updatePlayerFavoriteUI()
      updateVinylAnimation(true)

      // Update active class in lists
      document.querySelectorAll(".song-card").forEach(card => card.classList.remove("playing"))
      // This is a bit heavy, but ensures UI sync
      renderSongs()
      if (selectedPlaylistId) renderPlaylistSongs()
    })
    .catch(error => {
      console.error("Error playing song:", error)
      showToast("Fehler beim Abspielen", "error")
    })
}

function togglePlay() {
  const audioPlayer = document.getElementById("audio-player")
  if (songs.length === 0) return

  if (isPlaying) {
    audioPlayer.pause()
    isPlaying = false
    updateVinylAnimation(false)
  } else {
    if (currentSongIndex === -1) currentSongIndex = 0
    // If we have a src, just play, otherwise load
    if (audioPlayer.src) {
      audioPlayer.play()
      isPlaying = true
      updateVinylAnimation(true)
    } else {
      playSong()
    }
  }
  updatePlayButton()
}

function nextSong() {
  if (songs.length === 0) return

  if (isShuffle) {
    if (shuffledQueue.length === 0) generateShuffledQueue()
    // Find current index in shuffled queue
    let currentShuffledIndex = shuffledQueue.indexOf(currentSongIndex)
    // Move to next
    if (currentShuffledIndex === -1 || currentShuffledIndex >= shuffledQueue.length - 1) {
      currentShuffledIndex = 0 // Loop back
    } else {
      currentShuffledIndex++
    }
    currentSongIndex = shuffledQueue[currentShuffledIndex]
  } else {
    if (currentSongIndex < songs.length - 1) {
      currentSongIndex++
    } else {
      currentSongIndex = 0 // Loop back
    }
  }
  playSong()
}

function previousSong() {
  if (songs.length === 0) return

  if (isShuffle) {
    if (shuffledQueue.length === 0) generateShuffledQueue()
    let currentShuffledIndex = shuffledQueue.indexOf(currentSongIndex)
    if (currentShuffledIndex <= 0) {
      currentShuffledIndex = shuffledQueue.length - 1 // Loop back
    } else {
      currentShuffledIndex--
    }
    currentSongIndex = shuffledQueue[currentShuffledIndex]
  } else {
    if (currentSongIndex > 0) {
      currentSongIndex--
    } else {
      currentSongIndex = songs.length - 1 // Loop back
    }
  }
  playSong()
}

// New: Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return // Don't trigger when typing

    switch (e.code) {
      case "Space":
        e.preventDefault()
        togglePlay()
        break
      case "ArrowRight":
        nextSong()
        break
      case "ArrowLeft":
        previousSong()
        break
    }
  })
}

function playSongFromList(songId) {
  const index = songs.findIndex((s) => s.id === songId)
  if (index !== -1) {
    currentSongIndex = index
    playSong()
    switchSection("player-section")
  }
}

function playSongFromPlaylist(songId) {
  const index = songs.findIndex((s) => s.id === songId)
  if (index !== -1) {
    currentSongIndex = index
    playSong()
    switchSection("player-section")
  }
}

function playPlaylist() {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  if (!playlist || playlist.songs.length === 0) {
    showToast("Keine Songs in der Playlist", "error")
    return
  }

  const firstSongId = playlist.songs[0]
  const index = songs.findIndex((s) => s.id === firstSongId)

  if (index !== -1) {
    currentSongIndex = index
    playSong()
    switchSection("player-section")
  }
}

async function deleteSong(songId) {
  if (!confirm("Song wirklich löschen?")) return

  try {
    await deleteSongFromDB(songId)
    songs = songs.filter((s) => s.id !== songId)

    playlists.forEach((p) => {
      p.songs = p.songs.filter((id) => id !== songId)
    })

    // Save updated playlists
    for (const playlist of playlists) {
      await savePlaylistToDB(playlist)
    }

    renderSongs()
    renderPlaylists()
    updateStorageInfo()

    if (currentSongIndex >= songs.length) {
      currentSongIndex = Math.max(0, songs.length - 1)
    }
    showToast("Song gelöscht")
  } catch (error) {
    console.error("Fehler beim Löschen des Songs:", error)
    showToast("Fehler beim Löschen des Songs", "error")
  }
}

function playSong() {
  if (currentSongIndex < 0 || currentSongIndex >= songs.length) return

  const song = songs[currentSongIndex]
  const audio = document.getElementById("audio-player")

  try {
    // Create blob from ArrayBuffer
    const blob = new Blob([song.data], { type: song.type })
    const url = URL.createObjectURL(blob)

    audio.src = url
    audio.play().catch((error) => {
      console.error("Fehler beim Abspielen:", error)
    })

    isPlaying = true

    // Track statistics
    updateSongStatistics(song.id)

    updatePlayerDisplay()
    updateVinylAnimation(true)
  } catch (error) {
    console.error("Fehler beim Laden des Songs:", error)
    showToast("Fehler beim Laden des Songs", "error")
  }
}

function togglePlay() {
  const audio = document.getElementById("audio-player")

  if (isPlaying) {
    audio.pause()
    isPlaying = false
  } else {
    if (!audio.src && songs.length > 0) {
      playSong()
    } else if (audio.src) {
      audio.play().catch((error) => {
        console.error("Fehler beim Abspielen:", error)
      })
      isPlaying = true
    }
  }

  updatePlayerDisplay()
}

function nextSong() {
  if (currentSongIndex < songs.length - 1) {
    currentSongIndex++
    playSong()
  }
}

function previousSong() {
  if (currentSongIndex > 0) {
    currentSongIndex--
    playSong()
  }
}

function seekTrack() {
  const audio = document.getElementById("audio-player")
  if (audio.duration) {
    const progress = document.getElementById("progress-bar").value
    audio.currentTime = (progress / 100) * audio.duration
  }
}

function updatePlayerDisplay() {
  const song = songs[currentSongIndex]
  const audio = document.getElementById("audio-player")
  const playBtn = document.getElementById("play-btn")
  const playIcon = document.getElementById("play-icon")
  const vinylRecord = document.getElementById("vinyl-record")

  if (song) {
    document.getElementById("player-title").textContent = song.name
    document.getElementById("player-meta").textContent = `${currentSongIndex + 1} / ${songs.length}`
  }

  // Update vinyl animation
  if (isPlaying) {
    vinylRecord.classList.add("spinning")
    playIcon.innerHTML = '<path d="M6 4h4v16H6V4M14 4h4v16h-4V4z"/>'
  } else {
    vinylRecord.classList.remove("spinning")
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'
  }
}

function setupAudioListener() {
  const audio = document.getElementById("audio-player")

  audio.addEventListener("timeupdate", function () {
    if (this.duration) {
      const progress = (this.currentTime / this.duration) * 100
      document.getElementById("progress-bar").value = progress
      document.getElementById("current-time").textContent = formatTime(this.currentTime)
      document.getElementById("duration-time").textContent = formatTime(this.duration)
    }
  })

  audio.addEventListener("ended", () => {
    nextSong()
  })

  audio.addEventListener("error", () => {
    console.error("Audio-Fehler:", audio.error)
  })
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function setupVolumeControl() {
  document.getElementById("volume-control").addEventListener("input", function () {
    document.getElementById("audio-player").volume = this.value / 100
    document.getElementById("volume-value").textContent = this.value + "%"
  })
}

// ============================================
// Modal Management
// ============================================
function renderPlaylistSelector(containerId) {
  const container = document.getElementById(containerId)

  if (playlists.length === 0) {
    container.innerHTML = '<div class="empty-message">Keine Playlists vorhanden. Erstelle zunächst eine!</div>'
    return
  }

  const sorted = [...playlists].sort((a, b) => a.name.localeCompare(b.name))

  container.innerHTML = sorted
    .map(
      (p) => `
        <div class="playlist-option" data-playlist-id="${p.id}" onclick="togglePlaylistSelection(this)">
            ${p.name}
        </div>
    `,
    )
    .join("")
}

function togglePlaylistSelection(el) {
  document.querySelectorAll("#" + el.parentElement.id + " .playlist-option").forEach((e) => {
    e.classList.remove("selected")
  })
  el.classList.add("selected")
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active")
}

// ============================================
// Navigation
// ============================================
function switchSection(sectionId, navBtn = null) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"))
  document.getElementById(sectionId).classList.add("active")

  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"))

  if (navBtn) {
    navBtn.classList.add("active")
  } else {
    // Find the corresponding nav button
    const navBtnMap = {
      "upload-section": 0,
      "playlists-section": 1,
      "player-section": 2,
      "statistics-section": 3,
      "settings-section": 4,
    }
    const index = navBtnMap[sectionId]
    if (index !== undefined) {
      document.querySelectorAll(".nav-btn")[index].classList.add("active")
    }
  }
}

function switchStatsTab(tabName) {
  // Remove active from all tabs
  document.querySelectorAll('.stats-tab').forEach(tab => tab.classList.remove('active'))
  document.querySelectorAll('.stats-content').forEach(content => content.classList.remove('active'))

  // Add active to selected tab
  event.target.classList.add('active')
  document.getElementById(`stats-${tabName}`).classList.add('active')

  // Render appropriate content
  if (tabName === 'most-played') {
    renderMostPlayedSongs()
  } else if (tabName === 'recently-played') {
    renderRecentlyPlayed()
  } else if (tabName === 'trends') {
    renderListeningTrends()
  }
}

async function updateStorageInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage
      const quota = estimate.quota
      const percent = Math.round((used / quota) * 100)

      document.getElementById("storage-info").textContent =
        `${(used / 1024 / 1024).toFixed(2)} MB / ${(quota / 1024 / 1024).toFixed(0)} MB (${percent}%)`
    }
  } catch (error) {
    console.error("Fehler beim Abrufen der Speicherinfo:", error)
  }
}

async function clearAllData() {
  if (!confirm("Alle Daten werden gelöscht. Dies kann nicht rückgängig gemacht werden!")) return

  try {
    await clearAllDB()
    songs = []
    playlists = []
    currentSongIndex = 0
    selectedPlaylistId = null

    renderSongs()
    renderPlaylists()
    updateStorageInfo()

    alert("Alle Daten wurden gelöscht")
  } catch (error) {
    console.error("Fehler beim Löschen der Daten:", error)
    alert("Fehler beim Löschen der Daten")
  }
}

// ============================================
// Edit Song Functionality
// ============================================
function editSong(songId) {
  const song = songs.find((s) => s.id === songId)
  if (!song) return

  songToEditId = songId
  document.getElementById("edit-song-name-input").value = song.name
  document.getElementById("edit-song-modal").classList.add("active")
}

async function saveSongTitle() {
  if (!songToEditId) return

  const newName = document.getElementById("edit-song-name-input").value.trim()
  if (!newName) {
    alert("Bitte einen Namen eingeben")
    return
  }

  const song = songs.find((s) => s.id === songToEditId)
  if (song) {
    song.name = newName
    try {
      await saveSongToDB(song)
      renderSongs()
      if (selectedPlaylistId) {
        renderPlaylistDetail()
      }
      updatePlayerDisplay()
      closeModal("edit-song-modal")
      songToEditId = null
    } catch (error) {
      console.error("Fehler beim Speichern des Namens:", error)
      alert("Fehler beim Speichern des Namens")
    }
  }
}

// ============================================
// Statistics Rendering Functions
// ============================================
function renderMostPlayedSongs() {
  const container = document.getElementById("most-played-list")
  if (!container) return

  const sortedByPlays = [...songs]
    .filter(s => s.playCount > 0)
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, 20)

  if (sortedByPlays.length === 0) {
    container.innerHTML = '<div class="empty-message">Noch keine Wiedergaben</div>'
    return
  }

  const maxPlays = sortedByPlays[0].playCount

  container.innerHTML = sortedByPlays.map((song, index) => {
    const barWidth = (song.playCount / maxPlays * 100).toFixed(1)

    // Achievement badges
    let achievement = ''
    if (song.playCount >= 100) achievement = '🔥 Century Club'
    else if (song.playCount >= 50) achievement = '⭐ Super Hit'
    else if (song.playCount >= 20) achievement = '💫 Popular'

    return `
      <div class="stats-song-card">
        <div class="stats-rank">#${index + 1}</div>
        <div class="stats-song-info">
          <div class="stats-song-name">
            ${song.name}
            ${achievement ? `<span class="achievement-badge">${achievement}</span>` : ''}
          </div>
          <div class="stats-song-meta">
            🎵 ${song.playCount} Wiedergaben
          </div>
          <div class="play-count-bar">
            <div class="play-count-fill" style="width: ${barWidth}%"></div>
          </div>
        </div>
        <button class="btn-small" onclick="playSongFromList('${song.id}')">▶</button>
      </div>
    `
  }).join("")
}

function renderRecentlyPlayed() {
  const container = document.getElementById("recently-played-list")
  if (!container) return

  const sortedByRecent = [...songs]
    .filter(s => s.lastPlayed)
    .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
    .slice(0, 20)

  if (sortedByRecent.length === 0) {
    container.innerHTML = '<div class="empty-message">Noch keine Wiedergaben</div>'
    return
  }

  container.innerHTML = sortedByRecent.map(song => {
    const lastPlayed = new Date(song.lastPlayed)
    const timeAgo = getTimeAgo(lastPlayed)
    const timeDiff = new Date() - lastPlayed
    const isRecent = timeDiff < 3600000 // Less than 1 hour

    // Time badge styling
    const timeBadgeClass = isRecent ? 'time-badge recent' : 'time-badge'
    const timeIcon = isRecent ? '🔥' : '⏰'

    return `
      <div class="stats-song-card">
        <div class="stats-song-info">
          <div class="stats-song-name">
            ${song.name}
            ${isRecent ? '<span class="achievement-badge">🔥 Just Played</span>' : ''}
          </div>
          <div class="stats-song-meta">
            <span class="${timeBadgeClass}">${timeIcon} ${timeAgo}</span>
            <span>🎵 ${song.playCount || 0}x gespielt</span>
          </div>
        </div>
        <button class="btn-small" onclick="playSongFromList('${song.id}')">▶</button>
      </div>
    `
  }).join("")
}

function renderListeningTrends() {
  const container = document.getElementById("listening-trends")
  if (!container) return

  const totalPlays = songs.reduce((sum, s) => sum + (s.playCount || 0), 0)
  const songsWithPlays = songs.filter(s => s.playCount > 0).length
  const totalSongs = songs.length
  const avgPlaysPerSong = songsWithPlays > 0 ? (totalPlays / songsWithPlays).toFixed(1) : 0
  const completionRate = totalSongs > 0 ? ((songsWithPlays / totalSongs) * 100).toFixed(0) : 0

  const mostPlayedSong = [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0]

  // Calculate circular progress
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (completionRate / 100) * circumference

  container.innerHTML = `
    <div class="trends-grid">
      <div class="trend-card">
        <div class="trend-value">${totalPlays}</div>
        <div class="trend-label">🎵 Gesamt Wiedergaben</div>
      </div>
      <div class="trend-card">
        <div class="trend-value">${songsWithPlays}</div>
        <div class="trend-label">📀 Songs gespielt</div>
      </div>
      <div class="trend-card">
        <div class="trend-value">${avgPlaysPerSong}</div>
        <div class="trend-label">📊 Ø Wiedergaben/Song</div>
      </div>
      <div class="trend-card">
        <div class="circular-progress">
          <svg width="120" height="120">
            <circle class="bg" cx="60" cy="60" r="${radius}"></circle>
            <circle class="fg" cx="60" cy="60" r="${radius}" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${offset}"></circle>
          </svg>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            <div class="trend-value" style="font-size: 28px; margin: 0;">${completionRate}%</div>
          </div>
        </div>
        <div class="trend-label">🎯 Bibliothek erkundet</div>
      </div>
      ${mostPlayedSong && mostPlayedSong.playCount > 0 ? `
        <div class="trend-card highlight">
          <div class="trend-value" style="font-size: 20px;">👑 ${mostPlayedSong.name}</div>
          <div class="trend-label">Meistgespielter Song • ${mostPlayedSong.playCount}x wiedergegeben</div>
        </div>
      ` : ''}
    </div>
  `
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)

  const intervals = {
    Jahr: 31536000,
    Monat: 2592000,
    Woche: 604800,
    Tag: 86400,
    Stunde: 3600,
    Minute: 60
  }

  for (const [name, secondsInInterval] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInInterval)
    if (interval >= 1) {
      return `vor ${interval} ${name}${interval !== 1 ? (name === 'Monat' ? 'en' : name === 'Jahr' ? 'en' : 'n') : ''}`
    }
  }

  return 'gerade eben'
}

// ============================================
// Start Application
// ============================================
init()
