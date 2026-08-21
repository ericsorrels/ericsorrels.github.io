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

    // ---- The teaser video ----
    // Put your video file in the folder  assets/video/  and write its
    // name below. Leave "file" empty ("") and the whole video block
    // disappears from the page.
    video: {
      file: "assets/video/teaser.mp4",

      // A still image shown before anyone presses play. Optional —
      // leave it empty ("") and the first frame is used instead.
      // This one is the frame from 0:33 of the teaser.
      //
      // NOTE: when you replace this picture, give the new file a NEW
      // name and change it here too. Browsers keep a copy of every
      // image and will keep showing the old one if the name is reused.
      poster: "assets/img/teaser-poster-logo.jpg",

      // The shape of your video. Instagram posts are often square or
      // tall rather than wide, so set whichever matches:
      //   "wide"    a normal landscape video (16:9)
      //   "square"  as tall as it is wide (1:1)
      //   "tall"    a vertical phone video (9:16)
      shape: "tall",

      // A short line printed under the player. Leave empty ("") for none.
      caption: "Concept album teaser",

      // A second line under the caption, set brighter so it stands out.
      // Leave "text" empty ("") and the whole line disappears. Leave
      // "url" empty and the words still show, just not as a link.
      credit: {
        text: "Produced by Carolina Theater Workshop",
        url: "https://www.carolinatheatreworkshop.com/",
      },

      // Spoken aloud by screen readers for the play button. Not visible.
      play_label: "Play the teaser",
    },

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
            text: "A concept album featuring North Carolina and Broadway artists is recorded with the support of Carolina Theater Workshop",
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
    // Just replace the words inside each set of quotation marks with the
    // real song title. To add a track, copy a whole line — including the
    // comma at the end — and add the matching audio file.
    // The little volume slider that floats beside the track list.
    volume_label: "Vol",

    // Raise this number by one WHENEVER you replace an audio file that
    // is already on the live site. Browsers keep a copy of every track
    // they have played, and without this they go on playing the old one.
    // Adding brand-new tracks doesn't need it — only replacements.
    audio_version: 2,

    tracks_label: "The Album",
    tracks: [
      "The Legend of the Gray Man",
      "Hurricane Chatter (2004)",
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
      "Hurricane Chatter (2022)",
      "The Gray Man",
      "How to Be Young",
      "Is That You?",
      "The Legend of the Gray Man (Charli's Version)",
      "Eye of the Storm III",
      "I Will Reach For You",
      "The Gray Man (Voice Memo)",
    ],

    // Bonus tracks are set apart under their own heading. The number
    // below is the track the bonus section starts at — 20 means tracks
    // 20 and 21 sit below the heading, and 1 through 19 read as the
    // album proper. Set it to 0 to run all 21 as one continuous list.
    bonus_starts_at: 20,
    bonus_label: "Bonus Tracks",

    /* ---- The download buttons -------------------------------------------- */
    // Each button needs its matching file placed in  assets/downloads/
    // with exactly the file name shown after "file:".
    //
    // A vertical bar  |  inside a label starts a new line at that point,
    // so you can control where a long button title breaks.
    downloads_label: "Downloads",
    downloads: [
      { label: "Listening Guide", file: "assets/downloads/listening-guide.pdf" },
      { label: "Digital Lyric Book", file: "assets/downloads/digital-lyric-book.pdf" },
      { label: "About Pawleys Island and|The Gray Man", file: "assets/downloads/about-pawleys-island.pdf" },
      { label: "Download Full Album", file: "assets/downloads/the-gray-man-full-album.zip" },
    ],

    back_link: "Back to the main site",
  },
};
