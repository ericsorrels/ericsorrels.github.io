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

      // The terms, under the button. Shown in BOTH places the button
      // appears — here and on the access page's gate — from this one
      // line, the same way the address is shared, so the two can never
      // say different things.
      //
      // This is the site saying it. The policy itself is a setting in
      // Gumroad, and saying it here does not set it there. Nor does
      // either stop a card issuer allowing a chargeback — which is why
      // the vault still takes access away on a refund or dispute.
      //
      // Emptying it ("") removes the line.
      terms: "All sales are final.",
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
     There is no password. A visitor gives an email address and is sent
     a six-digit code — but only if the address is on the guest list,
     which lives at Cloudflare and not in this file. To let somebody in,
     add them on the admin page; nothing here changes.
     ======================================================================= */
  access: {

    // What the browser tab says on this page. The main page has its own,
    // under  meta  at the top of this file.
    browser_tab_title: "Early Digital Access — The Gray Man",

    /* ---- The locked door (what visitors see first) ----------------------
       Two steps: an email address, then the six-digit code sent to it.
       There is no password any more — nobody types a shared secret, and
       access is given and taken away one person at a time.
       --------------------------------------------------------------------- */

    gate_label: "Early Digital Access",

    // Step one: the address.
    gate_hint: "Enter the email address your access is under, and a six-digit code will be sent to it.",
    gate_placeholder: "Email address",      // read aloud by screen readers
    gate_button: "Send My Code",

    // What either button says while it is working, so a press is never
    // met with silence.
    gate_sending: "Sending…",

    // Step two: the code.
    //
    // gate_sent IS SHOWN WHETHER OR NOT THE ADDRESS HAS ACCESS, and that
    // is the point of how it is worded. If an approved address got a
    // different answer from an unapproved one, anybody could use this
    // page to find out who has bought the album. So it says "if", and
    // points somewhere useful either way.
    gate_sent:
      "If this email has access, a code is on its way. Check your spam folder, or email hello@ericsorrels.com for help.",
    gate_code_hint: "Type the six digits here.",
    gate_code_placeholder: "Six-digit code",   // read aloud by screen readers
    gate_code_button: "Enter",
    gate_another: "Send another code",
    gate_elsewhere: "Use a different email",

    /* ---- When something goes wrong at the door -------------------------- */

    // A mistyped address — said plainly, because this one is about what
    // was typed rather than about who is on the list.
    gate_bad_email: "That doesn't look like an email address. Please check it and try again.",

    // A wrong code. The second sentence earns its place: someone who
    // pressed the button twice has two emails, and the older code stopped
    // working the moment the newer one was sent.
    gate_code_wrong: "That code isn't right. If you asked more than once, use the code from the newest email.",

    gate_code_expired: "That code has expired, or has already been used. Ask for another one.",
    gate_code_locked: "Too many tries. Ask for another code and start again.",

    // Asked too many times, too quickly.
    gate_slow_down: "That's several codes now. Please wait a minute, then look in your spam folder.",

    // Shown when the album's keeper can't be reached at all — a dropped
    // connection, rather than anything the visitor did. Different
    // trouble, so it gets a different line.
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

    // The welcome film, under the heading. It replaced the paragraph
    // that used to sit here.
    //
    // The file must be an .mp4 — a .mov out of a phone or an editor is
    // usually in a format that Firefox and a lot of Windows computers
    // cannot play at all, and it is far too big besides. Put the
    // original in  assets/video/  and ask Claude to prepare it; the
    // original stays on your own computer and is never published.
    //
    //   shape       "tall" for a phone-shaped film, "wide" for a
    //               widescreen one, "square" for a square one
    //   caption     a line under the film. Empty ("") shows nothing.
    //   credit      a second, smaller line under that. Same rule.
    //   play_label  never seen — it is what a screen reader says about
    //               the play button
    //
    // Leaving  file  empty ("") removes the film from the page.
    welcome_video: {
      file: "assets/video/access-welcome.mp4",
      poster: "assets/img/access-welcome-poster.jpg",   // the frame at 0:20
      shape: "tall",
      caption: "",
      credit: {
        text: "",
        url: "",
      },
      play_label: "Play the welcome from Eric Sorrels",
    },

    /* ---- The closing, after the bonus tracks ----------------------------- */
    // A second film, at the foot of the page, and the words beneath it.
    // Same rules as the welcome film above — emptying  file  takes it away.
    thanks_video: {
      file: "assets/video/tgm-bhs.mp4",
      poster: "assets/img/tgm-bhs-poster.jpg",          // the frame at 0:25
      shape: "tall",
      caption: "",
      // The teaser on the main page credits Carolina Theatre Workshop.
      // This film carries their mark burned into the corner, so nothing
      // is written here — put text and a web address in if you want the
      // credit spelled out beneath it as well.
      credit: {
        text: "",
        url: "",
      },
      play_label: "Play the behind-the-scenes film",
    },
    // A vertical bar  |  starts a new line at that point.
    thanks:
      "Thank you for supporting *The Gray Man*! Be sure to pre-save the album on Spotify or Apple Music, and spread the word…|a hurricane is coming!",

    /* ---- The album tracks ------------------------------------------------ */
    // The album is ONE recording — see the block just below — and the
    // list of titles further down (  tracks:  ) names the songs inside
    // it, in order. There are no separate audio files per track any
    // more: a track is a position in the recording, measured from it.
    //
    // So the titles are yours to edit freely — just change the words
    // inside the quotation marks — but adding, removing or reordering a
    // song means rebuilding the recording as well. Ask Claude and it
    // will do it; see "To change the album" below.

    // The little volume slider that floats beside the track list. Shown
    // on a computer only: phones and iPads keep the volume under their
    // own buttons, and a page cannot change it there.
    volume_label: "Vol",

    // Raise this number by one WHENEVER the recording itself is replaced
    // on the live site. Browsers keep a copy of what they have played,
    // and without this they go on playing the old one.
    //
    // It is one file now — the whole album, 109 MB — so bump it only
    // when the recording genuinely changes. Every listener re-fetches
    // the lot the next time they press play.
    //
    // History: moved to 4 on 1 October 2026 when 15 and 16 were swapped,
    // back when the album was twenty files and reordering two of them
    // changed what two existing addresses meant. Left at 4 on 2 October
    // when the album became one recording: the address changed from
    // audio/NN.m4a to audio/album.m4a, so there was no old copy anywhere
    // to displace.
    audio_version: 4,

    /* ---- The album is ONE recording --------------------------------
       The songs run straight into each other, so the album is a single
       audio file and the track list is twenty positions inside it.
       There is nothing between one song and the next except the next
       moment of the recording — which is the only way it can be
       seamless AND go on playing when an iPhone is locked.

       DO NOT EDIT THE NUMBERS BELOW BY HAND. They are measured from
       the finished recording by  tools/join-album.py , which prints
       them ready to paste. Typing one in by eye would put a song's
       title, its words and its clock slightly out of step with the
       sound, and nothing would look wrong.

       To change the album: bounce the songs again as 01.wav … 20.wav,
       put them in a folder, and ask Claude. It rebuilds the recording,
       measures the new positions, and replaces this list. */

    // The file in the vault's  audio/  folder.
    album_file: "album.m4a",

    // Where each song begins, in seconds from the start of the album.
    // Measured 2 October 2026. Twenty of them, in album order.
    track_starts: [
      0.000000,    //  1  The Legend of the Gray Man
      348.345760,  //  2  Weather Chatter (2004)
      438.143129,  //  3  Hurricane Charli
      640.011610,  //  4  September, Remember
      683.275828,  //  5  Worth the Wait
      915.779592,  //  6  Pisces
      1163.402517, //  7  Riptide
      1348.268186, //  8  Eye of the Storm I
      1451.655034, //  9  Some Things Never Leave You
      1649.884376, // 10  Catch and Release
      1876.150431, // 11  This Way
      2103.201066, // 12  St. Elmo's Fire
      2207.261293, // 13  Eye of the Storm II
      2301.500590, // 14  Weather Chatter (2022)
      2448.017392, // 15  How to Be Young
      2707.500385, // 16  The Gray Man
      2932.530771, // 17  Is That You?
      3101.130862, // 18  Eye of the Storm III
      3230.130839, // 19  I Will Reach For You (Demo)
      3363.475215, // 20  The Gray Man_08-23-24 (Voice Memo)
    ],

    // How long the whole recording runs, which is where the last song
    // ends. 60 minutes 25.58 seconds.
    album_length: 3625.575215,
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

    // The arrows button in the lyrics panel, which opens the words out
    // to fill the whole screen — on a computer, in its corner; on a
    // phone, at the end of the row of buttons. These two are what it
    // says when you rest the pointer on it, and what a screen reader
    // calls it.
    lyrics_expand: "Full screen",
    lyrics_collapse: "Leave full screen",

    // The previous / play / next buttons in the panel's head, on every
    // screen. Nobody sees these words — they are what a screen reader
    // says aloud, and what shows if the icons ever fail to draw.
    panel_previous: "Previous track",
    panel_next: "Next track",
    panel_play: "Play",
    panel_pause: "Pause",

    // Raise this number by one whenever you add or change a lyrics
    // file, so listeners get the new words instead of a copy their
    // browser kept. Works exactly like audio_version above.
    // Moved to 4 on 1 October 2026 with the 15/16 swap, and to 5 on
    // 2 October when track 09 got its words.
    lyrics_version: 5,

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
    // Moved to 2 on 2 October 2026, when notes arrived for tracks 01–18.
    //
    // They may be .md or .txt — whichever you save, the page reads it
    // the same way. TextEdit writes .txt, so there is nothing to rename.
    notes_version: 2,

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

    /* ---- The sleeve's other side ----
       The album art turns over. The front is the cover above; the back
       is the credits — everyone who sang, played, recorded, mixed and
       paid for the record.

       Its description matters more than most, because the picture IS
       words: somebody who cannot see it gets nothing from "a page of
       credits". This stands in for the whole of it, so anyone reading
       with their ears still learns who made the album. Keep it in step
       if the credits are ever redrawn.

       The picture is  assets/img/album-credits.jpg , with the larger
       copy beside it for when it is opened up. Same as the cover:
       *stars* do nothing in these lines. */
    credits_alt: "The back of the album sleeve: the credits, in weathered capitals on aged paper. Words and music by Eric Sorrels. Produced by Eric Sorrels and Carolina Theater Workshop. The Gray Man sung by Michael Maliakel and Greg Toft; Charli Ballenger by Hannah Elless and Ella Frederickson; Theo Gray by Colin Donnell and Keagan Kermode; additional voices by Christopher Tramantana and Brock Ward. Band: Jesse Kapsha on keyboards, Eric Sorrels on synthesizers, Warren Sharp on guitar, Keith Lewis on bass, Vince Moss on drums. Arrangements by Christopher Gurr and Eric Sorrels. Recorded at Soundtrax Studios, North Carolina, by Cameron Fitzpatrick, and at Flux Studios, New York City, by Daniel Sanint. Mixed and mastered by Cameron Fitzpatrick. Album art by Cavan Hendron. Additional concept art by Kelsey Roy, Molly Kessler and Cavan Hendron. With special thanks to the studio manager sponsors. Copyright 2026 Pisces Theatrical LLC.",

    /* ---- Turning the sleeve over ----
       Read out to anyone using a screen reader, and shown as a tooltip
       on a computer. Nobody sees these unless they go looking, so they
       say plainly what the thing does. */
    sleeve_previous: "Show the album cover",
    sleeve_next: "Show the album credits",
    sleeve_open: "Open the album art larger",
    sleeve_close: "Close the album art",

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
      "How to Be Young": "Colin Donnell, Eric Sorrels, & Ella Frederickson",
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
      "How to Be Young",
      "The Gray Man",
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
    // Each button needs its matching file in the vault's "downloads"
    // folder, named EXACTLY as it appears after "file:" below. These
    // are not part of the website: the file goes in assets/downloads/
    // on this computer and is also uploaded to the downloads folder of
    // the grayman-vault bucket at Cloudflare. Only the second of those
    // is what a visitor receives.
    //
    // Raise this number by one whenever you replace a download with a
    // new version of itself, so people get the new one instead of the
    // copy their browser kept for an hour. Adding a download for the
    // first time doesn't need it.
    //
    // This is what audio_version and lyrics_version do, and until
    // 2 October 2026 downloads were the one thing without it — so
    // replacing a PDF used to mean renaming the file as well. It no
    // longer does: the same name is now safe.
    //
    // Moved to 2 on 3 October 2026 for the new listening guide, which
    // keeps the name listening-guide.pdf. This is exactly the case the
    // number exists for: same address, different file, and without the
    // bump anyone who had opened the old one would go on being handed
    // it for up to an hour with nothing to show anything was wrong.
    downloads_version: 2,

    // A vertical bar  |  inside a label starts a new line at that point,
    // so you can control where a long button title breaks.
    downloads_label: "Downloads",
    downloads: [
      { label: "Listening Guide", file: "downloads/listening-guide.pdf" },
      // Renamed from lyric-booklet.pdf on 2 October 2026 when the
      // booklet was replaced, under the rule that applied that morning.
      // downloads_version above now makes renaming unnecessary, so the
      // next replacement can keep this name — the longer one is worth
      // keeping anyway, since it is what a supporter ends up with in
      // their Downloads folder, where "lyric-booklet.pdf" says nothing
      // about whose it is.
      { label: "Lyric Booklet", file: "downloads/the-gray-man-lyric-booklet.pdf" },
      { label: "About the World", file: "downloads/about-the-world.pdf" },
    ],

    back_link: "Back to the main site",
  },
};
