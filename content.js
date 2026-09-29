/* =========================================================================
   THE GRAY MAN — ALL THE WORDS ON THE WEBSITE LIVE IN THIS FILE
   =========================================================================

   HOW TO EDIT
   -----------
   1. Change only the text between the "quotation marks".
   2. Leave everything else exactly as it is — the names before the
      colons, the commas at the ends of lines, and the { } [ ] brackets.
   3. To style words like the show's title (UPPERCASE, spaced out),
      wrap them in asterisks:  *The Gray Man*
   4. After saving this file, refresh the website in your browser to
      see your changes.
   ========================================================================= */

window.SITE_CONTENT = {

  /* ---- Browser tab & search engines ----------------------------------- */
  meta: {
    browser_tab_title: "The Gray Man — A Musical in Three Hurricanes",
    search_description:
      "THE GRAY MAN, a new musical written by Eric Sorrels. A musical in three hurricanes.",
  },

  /* ---- Menu at the top of the page ------------------------------------ */
  nav: {
    about: "About",
    music: "Music",
    news: "News",
    contact: "Contact",
  },

  /* ---- Opening screen (the "poster") ----------------------------------- */
  hero: {
    byline_label: "Written By",
    byline_name: "Eric Sorrels",

    // The title, one word per line. The first word is shown smaller,
    // just like "THE" on the poster.
    title: ["The", "Gray", "Man"],

    tagline: "A Musical in Three Hurricanes",
    scroll_cue: "Enter",
  },

  /* ---- About the Show --------------------------------------------------- */
  about: {
    label: "The Legend",

    // Each block in quotes is one paragraph. A thin divider line is
    // drawn between paragraphs automatically. To add a paragraph, copy
    // a whole line — including the comma at the end — and edit the text.
    paragraphs: [
      "They say that when a great storm is coming, a figure in gray appears on the beach — walking alone, warning anyone who will listen to leave the island. Those who see him are spared.",

      "Inspired by the folklore of coastal Carolina, *The Gray Man* is a new musical — told across three hurricanes — about the people we keep reaching for, and the cost of letting them go.",
    ],
  },

  /* ---- Music ------------------------------------------------------------ */
  music: {
    label: "The Music",

    // ---- The videos ----
    // Each { ... } block below is one video, shown top to bottom in the
    // order written here — so the newest goes first. They sit between
    // the concept album box and the buy button.
    //
    // To add a video: ask Claude to prepare the file (it has to be
    // shrunk and converted to play well on the web), then copy a whole
    // block — from its  {  to its  },  — and edit it. To take one down,
    // delete its block, or leave its "file" empty ("").
    //
    // What each line does:
    //   file        the video, in the folder  assets/video/
    //   poster      the still shown before anyone presses play, in
    //               assets/img/ — leave empty ("") to use the first frame.
    //               When you replace a picture, give the new file a NEW
    //               name: browsers keep showing the old one otherwise.
    //   shape       "wide" (16:9), "square" (1:1) or "tall" (9:16, phone)
    //   caption     the small line under the player; "" for none
    //   credit      a brighter second line, a link if it has a "url".
    //               "" in "text" hides it. A bar  |  marks where it
    //               breaks onto two lines ON PHONES only.
    //   play_label  read aloud by screen readers for the play button
    //               (never shown)
    videos: [
      {
        file: "assets/video/st-elmos-fire.mp4",
        poster: "assets/img/st-elmos-fire-poster.jpg",   // the frame at 1:39
        shape: "tall",
        caption: "St. Elmo's Fire — concept album teaser",
        credit: {
          text: "",
          url: "",
        },
        play_label: "Play the St. Elmo's Fire teaser",
      },
      {
        file: "assets/video/teaser.mp4",
        poster: "assets/img/teaser-poster-logo.jpg",     // the frame at 0:33
        shape: "tall",
        caption: "Concept album teaser",
        credit: {
          text: "Produced by|Carolina Theater Workshop",
          url: "https://www.carolinatheatreworkshop.com/",
        },
        play_label: "Play the teaser",
      },
    ],

    // The bordered "coming soon" box. When the album is ready, ask
    // Claude to swap this box for a streaming player.
    album_box_title: "The Gray Man — Original Concept Album",
    album_box_note: "Coming Fall 2026",

    // ---- The "buy early access" button ----
    // Sits underneath the concept album box.
    //
    // Paste the web address of your Gumroad product between the quotes
    // below. It looks something like:
    //     https://ericsorrels.gumroad.com/l/graymanearly
    //
    // While "url" is left empty ("") the button does not appear at all,
    // so the page never shows a link that goes nowhere.
    early_access: {
      url: "https://sorrels7.gumroad.com/l/earlyaccess",
      label: "Purchase Early Digital Access",
      note: "Hear the concept album before release.",
    },
  },

  /* ---- The Journey — the storm advisory track ----------------------------
     The show's development, plotted like a hurricane's track. Each block
     below is one advisory — a chapter of the storm — holding the events
     that happened during it. The line on the page draws itself from the
     first advisory down to landfall as the reader scrolls.
     ----------------------------------------------------------------------- */
  news: {
    label: "The Journey",

    // The line under the heading.
    intro: "The development of *The Gray Man*, plotted the way the coast plots a storm.",

    // The small key beside the track that explains the symbols.
    legend: {
      title: "Advisory Key",
      disturbance: "Disturbance",
      storm: "Tropical Storm",
      hurricane: "Hurricane",
      landfall: "Landfall",
      projected: "Projected Path",
    },

    // Stamped across the landfall card.
    landfall_stamp: "Landfall",

    // Each advisory's "strength" sets how the track draws it — the size
    // of its markers and how deeply red the line runs. Not words; leave
    // these numbers alone unless the storm itself changes course:
    //   1  a disturbance — small open circle, pencil gray
    //   2  a tropical storm — filled circle, the line warming
    //   3  hurricane, category 1
    //   4  hurricane, category 2
    //   5  hurricane, category 3 — landfall, the deepest red
    //   6  the projected path — the dashed line beyond landfall
    phases: [
      {
        advisory: "Advisory No. 1",
        name: "A Disturbance in the Water",
        category: "Tropical Disturbance",
        strength: 1,
        events: [
          {
            date: "January 2024",
            place: "35.8°N 78.6°W — Raleigh, NC",
            text: "The first song is written for the show — \"Riptide\".",
          },
          {
            date: "May 2024",
            place: "35.8°N 78.6°W — Raleigh, NC",
            text: "\"Riptide\" is performed as part of a solo show in Raleigh, North Carolina.",
          },
        ],
      },
      {
        advisory: "Advisory No. 2",
        name: "Wind Circulates",
        category: "Tropical Depression / Tropical Storm",
        strength: 2,
        events: [
          {
            date: "January 2025",
            place: "35.9°N 83.9°W — Knoxville, TN",
            text: "Public table read with the Tennessee Stage Company New Play Festival.",
          },
          {
            date: "April 2025",
            place: "40.7°N 74.0°W — New York, NY",
            text: "Select songs performed in concert at Joe's Pub in New York City.",
          },
          {
            date: "December 2025",
            place: "40.7°N 74.0°W — New York, NY",
            text: "Private table read in New York City.",
          },
        ],
      },
      {
        advisory: "Advisory No. 3",
        name: "An Eye Begins to Form",
        category: "Category 1",
        strength: 3,
        events: [
          {
            date: "May 2026",
            place: "35.8°N 78.6°W — Raleigh, NC",
            text: "29-hour reading with Carolina Theater Workshop in Raleigh, North Carolina.",
          },
        ],
      },
      {
        advisory: "Advisory No. 4",
        name: "Growing Intensity",
        category: "Category 2",
        strength: 4,
        events: [
          {
            date: "July – August 2026",
            place: "All Stations",
            text: "A concept album featuring North Carolina and Broadway artists is recorded with the support of Carolina Theater Workshop.",
          },
          {
            date: "October 2026",
            place: "All Stations",
            text: "The concept album releases.",
          },
        ],
      },
      {
        advisory: "Advisory No. 5",
        name: "First Landfall",
        category: "Category 3",
        strength: 5,
        events: [
          {
            date: "January 2027",
            place: "35.9°N 83.9°W — Knoxville, TN",
            text: "*The Gray Man* makes landfall in Knoxville, Tennessee, presented in partnership with the Clarence Brown Theatre (LORT) and the Tennessee Stage Company New Play Festival.",
          },
        ],
      },
      {
        advisory: "Advisory No. 6",
        name: "Projected Path",
        category: "Forecast Position",
        strength: 6,
        events: [
          {
            date: "Spring 2027",
            place: "40.7°N 74.0°W — New York, NY",
            text: "Concert presentation at Joe's Pub in New York City produced by Carolina Theater Workshop.",
          },
        ],
      },
    ],
  },

  /* ---- Pawleys Island weather -------------------------------------------
     Live conditions from the stretch of coast the show is set on.
     ----------------------------------------------------------------------- */
  weather: {
    label: "Pawleys Island, South Carolina",
    heading: "Current Weather Conditions",

    // Shown while the reading is being fetched, and if it can't be reached.
    loading_text: "Reading the sky…",
    error_text: "The island's weather is out of reach just now.",

    // The labels beside each reading.
    labels: {
      feels_like: "Feels Like",
      wind: "Wind",
      gust: "Gust",
      clouds: "Cloud Cover",
      pressure: "Pressure",
      visibility: "Visibility",
      rain: "Rain",
      humidity: "Humidity",
    },
    rain_none: "None",

    /* --- Settings (not words — change only if something breaks) --- */
    // Pawleys Island, South Carolina
    latitude: 33.42,
    longitude: -79.12,

    // ---- Where the reading comes from ----
    //
    // The relay at Cloudflare (see the "cloudflare" folder). It fetches
    // the weather once, holds it for ten minutes, and hands that same
    // copy to every visitor — so the weather service is called a few
    // times an hour no matter how busy the site is.
    //
    // "/api/weather" means "this same website" — the reading is asked
    // for at graymanmusical.com itself, and Cloudflare quietly hands
    // that address to the relay. This is deliberate: strict office and
    // school networks block the relay's own workers.dev address, but
    // they cannot block the site's own address without blocking the
    // site. Don't replace this with a full web address.
    //
    // The weather key lives at Cloudflare, not here. Nothing secret
    // belongs in this file: every word of it is public, because anyone
    // can read it at graymanmusical.com/content.js
    proxy_url: "/api/weather",

    // Only used if the line above doesn't answer — the relay's own
    // address at Cloudflare. Leave it: it keeps the weather working on
    // previews and anywhere the address above isn't wired up yet.
    proxy_fallback_url: "https://gray-man-weather.withered-credit-543f.workers.dev",

    // How long each visitor's browser keeps a reading, in minutes.
    refresh_minutes: 12,
  },

  /* ---- Subscribe (sits under the weather, same section) ------------------
     Typing an email here carries it over to Substack, where the reader
     finishes signing up. Nothing is stored on this website.
     ----------------------------------------------------------------------- */
  subscribe: {
    // The call to action, set large above the email field.
    heading: "Track the Storm",

    // The line underneath it.
    intro: "Subscribe below for advisories, updates, and warnings from The Gray Man",

    placeholder: "Your email",
    button: "Subscribe",
    note: "Delivered by Substack. Ignore at your own risk.",

    // Your Substack. If you ever move it, change this one address.
    substack_url: "https://graymanmusical.substack.com/subscribe",
  },

  /* ---- Contact & Press ---------------------------------------------------
     Each { ... } block below becomes one column. To add another — a press
     agent, a licensing contact — copy a whole block, commas and all.
     Any line you leave empty ("") is simply left off the page.
     ----------------------------------------------------------------------- */
  contact: {
    label: "Representation",
    blocks: [
      {
        heading: "Agent",
        name: "Jonathan Lomma",
        company: "",
        email: "JLomma@WMEAgency.com",
        phone: "+1 (212) 903 1552",
      },
      {
        heading: "General Inquiries",
        name: "",
        company: "",
        email: "hello@ericsorrels.com",
        phone: "",
      },
    ],
  },

  /* ---- Small print at the very bottom of the page ------------------------ */
  footer: {
    lines: [
      "The Gray Man — A Musical in Three Hurricanes",
      "© 2026 Eric Sorrels. All rights reserved.",
    ],
  },

  /* =======================================================================
     EARLY DIGITAL ACCESS PAGE  (access.html)
     The password itself is NOT stored here — to change it, ask Claude.
     ======================================================================= */
  access: {

    /* ---- The locked door (what visitors see first) ---------------------- */
    gate_label: "Early Digital Access",
    gate_hint: "Enter the password from your invitation.",
    gate_placeholder: "Password",
    gate_button: "Enter",
    gate_error: "That password isn't right — please check your invitation and try again.",

    // Shown when the album's keeper can't be reached at all — a dropped
    // connection, rather than a wrong password. Different trouble, so
    // it gets a different line.
    gate_offline: "The vault is out of reach just now. Try again in a moment.",

    // The way in for someone who arrived without a password. The shop
    // address is NOT repeated here — this button uses the same one as
    // the button on the main page, at  music.early_access.url  above,
    // so there is only ever one address to change. While that is left
    // empty ("") neither button appears at all.
    gate_no_invite: "No invitation?",
    gate_buy: "Purchase Full Digital Access",

    /* ---- Once inside ----------------------------------------------------- */
    label: "Early Digital Access",
    heading: "The Concept Album",
    intro:
      "Welcome — and thank you for supporting *The Gray Man*. The concept album lives here, along with a few companions for your listening.",

    /* ---- The album tracks ------------------------------------------------ */
    // One line per track, in album order. The matching audio files go in
    // the folder  assets/audio/  numbered to match this list:
    // 01.mp3 is the first line, 02.mp3 the second, and so on to 21.mp3.
    //
    // That folder is now only on your own computer — the album itself
    // lives in private storage, away from the website. So a new or
    // replaced track has to be put into the vault as well as into that
    // folder, or it will read "Soon". Ask Claude and it will do it.
    //
    // Just replace the words inside each set of quotation marks with the
    // real song title. To add a track, copy a whole line — including the
    // comma at the end — and add the matching audio file.
    // The little volume slider that floats beside the track list.
    volume_label: "Vol",

    // Raise this number by one WHENEVER you replace an audio file that
    // is already on the live site. Browsers keep a copy of every track
    // they have played, and without this they go on playing the old one.
    // Adding brand-new tracks doesn't need it — only replacements.
    audio_version: 3,

    /* ---- The panel that follows the track ----
       Opens and closes with a small tab in the bottom corner. Inside it
       are two views of whatever is playing — its words, and whatever
       you've written about it — so the panel is named for both. */
    panel_button: "Liner Notes",

    /* ---- The words ----
       The panel's first tab, and the one a listener sees first. The
       words themselves are files in the folder  assets/lyrics/  —
       there's a note in there explaining how to add them. Like the
       audio, that folder stays on your computer and the words are
       kept in the vault, so a new one has to go to both. */
    lyrics_button: "Lyrics",
    lyrics_waiting: "Press play on any track and its words appear here.",

    // The same moment, but with the words filling the screen — where the
    // track list is hidden behind them, so there is nothing to point at
    // except the play button along the bottom.
    lyrics_waiting_expanded: "Press play to begin.",

    // And the same moment on a phone, where the panel covers the track
    // list but carries its own play button at the top.
    lyrics_waiting_phone: "Press play to begin the album.",

    lyrics_loading: "Finding the words…",
    lyrics_none: "No lyrics for this track",

    // The little arrows button in the corner of the lyrics panel, which
    // opens the words out to fill the whole screen. These two are what
    // it says when you rest the pointer on it. On a computer only —
    // there's no room for it on a phone.
    lyrics_expand: "Full screen",
    lyrics_collapse: "Leave full screen",

    // The three round buttons at the top of the panel on a phone. Nobody
    // sees these words — they are what a screen reader says aloud, and
    // what shows if the icons ever fail to draw.
    panel_previous: "Previous track",
    panel_next: "Next track",
    panel_play: "Play",
    panel_pause: "Pause",

    // Raise this number by one whenever you add or change a lyrics
    // file, so listeners get the new words instead of a copy their
    // browser kept. Works exactly like audio_version above.
    lyrics_version: 3,

    /* ---- What you've written about the song ----
       The panel's other tab, beside Lyrics. Whichever tab a listener
       last chose is the one they come back to. The notes themselves
       are files in the folder  assets/notes/  — there's a note in
       there explaining how to write them. Same as the words: that
       folder is yours, and the vault keeps the published copy. */
    notes_button: "Notes",
    notes_waiting: "Press play on any track and its notes appear here.",
    notes_loading: "Finding the notes…",
    notes_none: "No notes for this track",

    // Raise this by one whenever you add or change a notes file, the
    // same way as lyrics_version just above.
    notes_version: 1,

    /* ---- The album's cover ----
       The picture above the track list. Nobody reads these words: they
       are what a screen reader says aloud to someone who cannot see the
       sleeve, and what shows in its place if the file ever goes astray.
       So describe the picture, don't advertise it.

       The picture itself is  assets/img/album-cover.jpg  — to change
       it, put the new one in that folder under a NEW name and ask
       Claude to point the page at it.

       One difference from the rest of this file: *stars* do nothing
       here. Everywhere else they set the show's name in capitals, but
       this line is read out rather than drawn, and a star read aloud
       is just noise. Write the title plainly. */
    cover_alt: "The album cover: a wave breaking on a foggy Carolina beach, a pier behind it in the mist, with the hand-painted title The Gray Man across the sky. Written by Eric Sorrels. A Musical in Three Hurricanes.",

    /* ---- What a phone shows while a track plays ----
       Start a song and the handset takes it over: the lock screen, the
       Control Center, a car stereo over Bluetooth, the squeeze of an
       AirPod. All of them show the song's title — which comes from the
       list below — with these two lines under it, and the sleeve beside
       them. Nothing here appears on the website itself. */
    media_album: "The Gray Man",

    // Who the phone credits when no singer is named for the song below.
    media_artist: "Eric Sorrels",

    /* ---- Who sings each one ----
       Type the singer's name between the quotation marks after a song.
       Leave one empty and that song is credited to the name just above
       instead. Write it exactly as you want it read:

           "Riptide": "Sarah Vaughn",
           "Pisces": "Eric Sorrels & Marcus Lee",

       Every song on the album is already listed here, spelled the way
       it is spelled in the track list further down, so you never have
       to type a title. If you ever rename a song, rename it in both
       places — a name here that matches no song is ignored, and the
       song quietly falls back to the line above. */
    track_artists: {
      "The Legend of the Gray Man": "Greg Toft, Ella Frederickson, & Keagan Kermode",
      "Weather Chatter (2004)": "Brock Ward",
      "Hurricane Charli": "Ella Frederickson, Keagan Kermode, & Charlie Brady",
      "September, Remember": "Christopher Tramantana",
      "Worth the Wait": "Greg Toft & Ella Frederickson",
      "Pisces": "Keagan Kermode, Charlie Brady, & Ella Frederickson",
      "Riptide": "Michael Maliakel, Ella Frederickson, & Eric Sorrels",
      "Eye of the Storm I": "Eric Sorrels",
      "Some Things Never Leave You": "Greg Toft, Ella Frederickson, & Keagan Kermode",
      "Catch and Release": "Hannah Elless",
      "This Way": "Ella Frederickson & Keagan Kermode",
      "St. Elmo's Fire": "Eric Sorrels",
      "Eye of the Storm II": "Eric Sorrels",
      "Weather Chatter (2022)": "Brock Ward",
      "The Gray Man": "Ella Frederickson",
      "How to Be Young": "Colin Donnell",
      "Is That You?": "Greg Toft & Ella Frederickson",
      "Eye of the Storm III": "Eric Sorrels",
      "I Will Reach For You (Demo)": "Eric Sorrels",
      "The Gray Man_08-23-24 (Voice Memo)": "Eric Sorrels"
    },

    tracks: [
      "The Legend of the Gray Man",
      "Weather Chatter (2004)",
      "Hurricane Charli",
      "September, Remember",
      "Worth the Wait",
      "Pisces",
      "Riptide",
      "Eye of the Storm I",
      "Some Things Never Leave You",
      "Catch and Release",
      "This Way",
      "St. Elmo's Fire",
      "Eye of the Storm II",
      "Weather Chatter (2022)",
      "The Gray Man",
      "How to Be Young",
      "Is That You?",
      "Eye of the Storm III",
      "I Will Reach For You (Demo)",
      "The Gray Man_08-23-24 (Voice Memo)",
    ],

    // Bonus tracks are set apart under their own heading. The number
    // below is the track the bonus section starts at — 19 means tracks
    // 19 and 20 sit below the heading, and 1 through 18 read as the
    // album proper. Set it to 0 to run all 20 as one continuous list.
    bonus_starts_at: 19,
    bonus_label: "Bonus Tracks",

    /* ---- The download buttons -------------------------------------------- */
    // Each button needs its matching file placed in the vault's
    // "downloads" folder with exactly the file name shown after
    // "file:". These are no longer part of the website — ask Claude to
    // put a new one in the vault for you.
    //
    // A vertical bar  |  inside a label starts a new line at that point,
    // so you can control where a long button title breaks.
    downloads_label: "Downloads",
    downloads: [
      { label: "Listening Guide", file: "downloads/listening-guide.pdf" },
      { label: "Lyric Booklet", file: "downloads/digital-lyric-book.pdf" },
      { label: "About the World", file: "downloads/about-pawleys-island.pdf" },
    ],

    back_link: "Back to the main site",
  },
};
