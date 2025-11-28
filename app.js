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
let pendingUploadFile = null

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
    setupFileInput()
    setupAudioListener()
    setupVolumeControl()
    renderSongs()
    renderPlaylists()
    setupGenreButtons()
    setupMoodButtons()
    setupTimeButtons()
    updateStorageInfo()
  } catch (error) {
    console.error("Fehler beim Initialisieren der App:", error)
    alert("Fehler beim Laden der Datenbank. Bitte aktualisieren Sie die Seite.")
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
    alert("Bitte nur Audiodateien auswählen")
    return
  }

  if (audioFiles.length > 1) {
    audioFiles.forEach((file, index) => {
      setTimeout(() => {
        pendingUploadFile = file
        openUploadModal()
      }, index * 300)
    })
  } else {
    pendingUploadFile = audioFiles[0]
    openUploadModal()
  }
}

function openUploadModal() {
  if (!pendingUploadFile) return

  document.getElementById("song-name-input").value = pendingUploadFile.name.replace(/\.[^/.]+$/, "")
  renderPlaylistSelector("upload-playlist-selector")
  document.getElementById("upload-modal").classList.add("active")
}

async function confirmUpload() {
  if (!pendingUploadFile) return

  const songName = document.getElementById("song-name-input").value.trim()
  if (!songName) {
    alert("Bitte einen Song-Namen eingeben")
    return
  }

  try {
    const selectedPlaylist = document.querySelector(".playlist-option.selected")
    const playlistId = selectedPlaylist ? selectedPlaylist.dataset.playlistId : null

    const reader = new FileReader()

    reader.onerror = () => {
      alert("Fehler beim Lesen der Datei")
    }

    reader.onload = async (e) => {
      const song = {
        id: Date.now().toString(),
        name: songName,
        data: e.target.result, // Blob data
        type: pendingUploadFile.type,
        playlistId: playlistId,
        dateAdded: new Date().toISOString(),
        size: pendingUploadFile.size,
      }

      try {
        await saveSongToDB(song)
        songs.push(song)
        renderSongs()
        closeModal("upload-modal")
        pendingUploadFile = null
        document.getElementById("song-name-input").value = ""
        updateStorageInfo()
      } catch (error) {
        console.error("Fehler beim Speichern des Songs:", error)
        alert("Fehler beim Speichern des Songs. Möglicherweise reicht der Speicher nicht aus.")
      }
    }

    reader.readAsArrayBuffer(pendingUploadFile)
  } catch (error) {
    console.error("Fehler beim Upload:", error)
    alert("Fehler beim Upload der Datei")
  }
}

// ============================================
// Playlists Management
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
    alert("Bitte Name und Musikrichtung auswählen")
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
  } catch (error) {
    console.error("Fehler beim Erstellen der Playlist:", error)
    alert("Fehler beim Erstellen der Playlist")
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
        <button class="play-playlist-btn" onclick="playPlaylist()">▶ Playlist abspielen</button>
        <button class="add-songs-btn" onclick="openAddSongsModal()">+ Songs hinzufügen</button>
    `

  document.getElementById("playlist-detail-container").innerHTML = detailHTML
  renderPlaylistSongs()
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
                <button class="btn-small" onclick="playSongFromPlaylist('${song.id}')">▶</button>
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
  } catch (error) {
    console.error("Fehler beim Hinzufügen von Songs:", error)
    alert("Fehler beim Hinzufügen von Songs")
  }
}

async function removeSongFromPlaylist(songId) {
  const playlist = playlists.find((p) => p.id === selectedPlaylistId)
  playlist.songs = playlist.songs.filter((id) => id !== songId)

  try {
    await savePlaylistToDB(playlist)
    renderPlaylistDetail()
  } catch (error) {
    console.error("Fehler beim Entfernen des Songs:", error)
    alert("Fehler beim Entfernen des Songs")
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

  if (songs.length === 0) {
    container.innerHTML = '<div class="empty-message">Noch keine Songs hochgeladen</div>'
    return
  }

  const sortedSongs = [...songs].sort((a, b) => a.name.localeCompare(b.name))

  container.innerHTML = sortedSongs
    .map((song) => {
      const playlist = playlists.find((p) => p.id === song.playlistId)
      return `
            <div class="song-card">
                <div class="song-info">
                    <div class="song-name">${song.name}</div>
                    <div class="song-meta">${playlist ? `Playlist: ${playlist.name}` : "Keine Playlist"}</div>
                </div>
                <div class="song-actions">
                    <button class="btn-small" onclick="playSongFromList('${song.id}')">▶</button>
                    <button class="btn-small btn-danger" onclick="deleteSong('${song.id}')">✕</button>
                </div>
            </div>
        `
    })
    .join("")
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
    alert("Keine Songs in der Playlist")
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
  } catch (error) {
    console.error("Fehler beim Löschen des Songs:", error)
    alert("Fehler beim Löschen des Songs")
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
    updatePlayerDisplay()
  } catch (error) {
    console.error("Fehler beim Laden des Songs:", error)
    alert("Fehler beim Laden des Songs")
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

  if (song) {
    document.getElementById("player-title").textContent = song.name
    document.getElementById("player-meta").textContent = `${currentSongIndex + 1} / ${songs.length}`
  }

  if (isPlaying) {
    playIcon.innerHTML = '<path d="M6 4h4v16H6V4M14 4h4v16h-4V4z"/>'
  } else {
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
      "settings-section": 3,
    }
    const index = navBtnMap[sectionId]
    if (index !== undefined) {
      document.querySelectorAll(".nav-btn")[index].classList.add("active")
    }
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
// Start Application
// ============================================
init()
