/**
 * Tieng Anh Lop 4 — Video Player App
 * Matching reference site AudioIgniter behavior:
 * - Each section has its own independent player
 * - Click track -> plays in that section's video
 * - Pause other sections when one starts
 * - Search/filter, localStorage persistence
 */

(function () {
  "use strict";

  // --- State ---
  var activeSection = -1;
  var activeTrack = -1;
  var saveTimer = null;
  var STORAGE_KEY = "lop4_video_state";

  // --- Helpers ---
  function $(id) { return document.getElementById(id); }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  // --- Save / Load ---
  function saveState() {
    try {
      var video = $("video-" + activeSection);
      var state = {
        section: activeSection,
        track: activeTrack,
        time: video ? video.currentTime || 0 : 0,
        ts: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  // --- Pause all videos except one section ---
  function pauseAllExcept(exceptSection) {
    VIDEO_DATA.forEach(function (_, si) {
      if (si !== exceptSection) {
        var v = $("video-" + si);
        if (v && !v.paused) v.pause();
      }
    });
  }

  // --- Play a track ---
  function playTrack(sectionIndex, trackIndex) {
    var section = VIDEO_DATA[sectionIndex];
    if (!section || !section.videos[trackIndex]) return;

    var track = section.videos[trackIndex];
    var src = "videos/" + section.id + "/" + track.file;

    // Pause others
    pauseAllExcept(sectionIndex);

    // Get elements for this section
    var video = $("video-" + sectionIndex);
    var placeholder = $("placeholder-" + sectionIndex);
    var controls = $("controls-" + sectionIndex);
    var nowPlaying = $("nowplaying-" + sectionIndex);
    var counter = $("counter-" + sectionIndex);

    // Show video, hide placeholder
    placeholder.style.display = "none";
    video.style.display = "block";
    controls.style.display = "flex";

    // Set source and play
    video.src = src;
    video.load();
    video.play().catch(function () {});

    // Update controls
    nowPlaying.textContent = track.name;
    counter.textContent = (trackIndex + 1) + "/" + section.videos.length;

    // Update prev/next buttons
    var prevBtn = controls.querySelector(".ai-prev");
    var nextBtn = controls.querySelector(".ai-next");
    prevBtn.disabled = trackIndex <= 0;
    nextBtn.disabled = trackIndex >= section.videos.length - 1;

    // Update active track in tracklist
    var tracklist = $("tracklist-" + sectionIndex);
    $$(".ai-track", tracklist).forEach(function (el) {
      el.classList.remove("active");
    });
    var activeEl = tracklist.querySelector('.ai-track[data-index="' + trackIndex + '"]');
    if (activeEl) {
      activeEl.classList.add("active");
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Clear active in OTHER sections' tracklists
    VIDEO_DATA.forEach(function (_, si) {
      if (si !== sectionIndex) {
        $$(".ai-track.active", $("tracklist-" + si)).forEach(function (el) {
          el.classList.remove("active");
        });
      }
    });

    // Update state
    activeSection = sectionIndex;
    activeTrack = trackIndex;

    // Scroll video into view
    var player = $("player-" + sectionIndex);
    player.scrollIntoView({ behavior: "smooth", block: "start" });

    saveState();
  }

  // --- Event: Track click ---
  document.addEventListener("click", function (e) {
    var subBtn = e.target.closest(".ai-track-sub");
    if (subBtn) {
      e.stopPropagation();
      var srtPath = subBtn.dataset.srt;
      var trackEl = subBtn.closest(".ai-track");
      var trackName = trackEl ? trackEl.dataset.name : "Phụ đề";
      showSubtitle(srtPath, trackName);
      return;
    }

    var track = e.target.closest(".ai-track");
    if (track) {
      var si = parseInt(track.dataset.section, 10);
      var ti = parseInt(track.dataset.index, 10);
      playTrack(si, ti);
      return;
    }

    // Prev/Next buttons
    var prevBtn = e.target.closest(".ai-prev");
    if (prevBtn) {
      var si2 = parseInt(prevBtn.dataset.section, 10);
      if (si2 === activeSection && activeTrack > 0) {
        playTrack(activeSection, activeTrack - 1);
      }
      return;
    }
    var nextBtn = e.target.closest(".ai-next");
    if (nextBtn) {
      var si3 = parseInt(nextBtn.dataset.section, 10);
      if (si3 === activeSection && activeTrack < VIDEO_DATA[activeSection].videos.length - 1) {
        playTrack(activeSection, activeTrack + 1);
      }
      return;
    }
  });

  // --- Video events (attach to all video elements) ---
  function attachVideoEvents() {
    VIDEO_DATA.forEach(function (_, si) {
      var video = $("video-" + si);
      if (!video) return;

      video.addEventListener("timeupdate", function () {
        if (!saveTimer) {
          saveTimer = setTimeout(function () {
            saveState();
            saveTimer = null;
          }, 3000);
        }
      });

      video.addEventListener("ended", function () {
        saveState();
        // Auto-play next in same section
        if (si === activeSection && activeTrack < VIDEO_DATA[si].videos.length - 1) {
          playTrack(si, activeTrack + 1);
        }
      });

      video.addEventListener("pause", function () {
        saveState();
      });
    });
  }

  // --- Search / Filter ---
  var searchInput = $("searchInput");
  var searchClear = $("searchClear");
  var noResults = $("noResults");

  searchInput.addEventListener("input", function () {
    filterVideos(searchInput.value.trim().toLowerCase());
  });

  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    filterVideos("");
    searchInput.focus();
  });

  function filterVideos(query) {
    var totalVisible = 0;

    VIDEO_DATA.forEach(function (section, si) {
      var tracklist = $("tracklist-" + si);
      var tracks = $$(".ai-track", tracklist);
      var sectionVisible = 0;

      tracks.forEach(function (track) {
        var name = (track.dataset.name || "").toLowerCase();
        if (!query || name.indexOf(query) !== -1) {
          track.classList.remove("search-hidden");
          sectionVisible++;
        } else {
          track.classList.add("search-hidden");
        }
      });

      // Show/hide entire section column
      var col = tracklist.closest(".content-col");
      if (sectionVisible === 0 && query) {
        col.classList.add("search-hidden");
      } else {
        col.classList.remove("search-hidden");
        totalVisible += sectionVisible;
      }
    });

    noResults.style.display = (totalVisible === 0 && query) ? "block" : "none";
  }

  // --- Keyboard shortcuts ---
  document.addEventListener("keydown", function (e) {
    if (e.target === searchInput) return;
    if (activeSection < 0) return;

    var video = $("video-" + activeSection);
    if (!video) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case "ArrowLeft":
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case "ArrowRight":
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        break;
    }
  });

  // --- Restore session ---
  function restoreSession() {
    var state = loadState();
    if (!state || state.section < 0) return;
    if (state.section >= VIDEO_DATA.length) return;
    if (state.track >= VIDEO_DATA[state.section].videos.length) return;

    playTrack(state.section, state.track);

    if (state.time > 0) {
      var video = $("video-" + state.section);
      var onLoad = function () {
        video.currentTime = state.time;
        video.removeEventListener("loadedmetadata", onLoad);
      };
      video.addEventListener("loadedmetadata", onLoad);
    }
  }

  // --- Init ---
  function init() {
    attachVideoEvents();
    restoreSession();
  }

  // --- Subtitle Viewer ---
  function parseSRT(text) {
    var blocks = text.trim().split(/\r?\n\r?\n/);
    var subs = [];
    blocks.forEach(function (block) {
      var lines = block.split(/\r?\n/);
      if (lines.length >= 3) {
        var index = lines[0];
        var timeLine = lines[1];
        var english = lines[2];
        var vietnamese = lines.length > 3 ? lines[3] : "";
        
        var timeParts = timeLine.split(" --> ");
        var timeStart = timeParts[0] ? timeParts[0].split(",")[0] : "";
        if (timeStart.startsWith("00:")) {
          timeStart = timeStart.substring(3);
        }
        
        subs.push({
          index: index,
          timeStart: timeStart,
          english: english,
          vietnamese: vietnamese
        });
      }
    });
    return subs;
  }

  function showSubtitle(srtPath, trackName) {
    var modal = $("subModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "subModal";
      modal.className = "sub-modal-overlay";
      modal.innerHTML = `
        <div class="sub-modal">
          <div class="sub-modal-header">
            <h3 id="subModalTitle">Phụ đề song ngữ</h3>
            <button id="subModalClose" class="sub-modal-close"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg></button>
          </div>
          <div class="sub-modal-body">
            <table class="sub-table">
              <thead>
                <tr>
                  <th class="col-index">#</th>
                  <th class="col-time">Thời gian</th>
                  <th class="col-en">Tiếng Anh</th>
                  <th class="col-vi">Tiếng Việt</th>
                </tr>
              </thead>
              <tbody id="subModalBody"></tbody>
            </table>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      $("subModalClose").addEventListener("click", function() {
        modal.style.display = "none";
      });
      modal.addEventListener("click", function(e) {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    }

    $("subModalTitle").textContent = trackName;
    modal.style.display = "flex";

    // Read from embedded SUBTITLE_DATA (no fetch needed)
    var subs = (typeof SUBTITLE_DATA !== "undefined" && SUBTITLE_DATA[srtPath]) ? SUBTITLE_DATA[srtPath] : null;
    
    if (!subs || subs.length === 0) {
      $("subModalBody").innerHTML = '<tr><td colspan="4" style="text-align:center">Không có dữ liệu phụ đề.</td></tr>';
      return;
    }

    var html = "";
    subs.forEach(function(sub, i) {
      html += "<tr>";
      html += '<td class="col-index">' + (i + 1) + '</td>';
      html += '<td class="col-time">' + sub.t + '</td>';
      html += '<td class="col-en">' + sub.en + '</td>';
      html += '<td class="col-vi">' + sub.vi + '</td>';
      html += "</tr>";
    });
    $("subModalBody").innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
