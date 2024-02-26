"use strict";

import { config } from "dotenv";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// *************
// Configuration
// *************

// -- Leaflet
const DEFAULT_VIEW = { position: [51.1461386, 10.3], zoom: 6, maxZoom: 20 };
// -- Maptiler
const MAPTILER_API_KEY = "pWHtUNbxIERMz5GXuNLb";
// -- Backend-API
const API_ORIGIN = "https://cbe-budy-map.netlify.app";

// *************
// Elements
// *************
const mapsection = document.getElementById("map");
const infoSection = document.getElementById("userinfo-section");
const btnCloseInfoSection = document.getElementById("btn-close");
const btnClosePopUp = document.getElementsByClassName(
  "leaflet-popup-close-button"
);
const userdata = document.getElementById("userdata");
const btnLogout = document.getElementById("logout");

// Define and initiate Map
const map = L.map("map").setView(DEFAULT_VIEW.position, DEFAULT_VIEW.zoom);
L.tileLayer(
  `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`,
  {
    maxZoom: DEFAULT_VIEW.maxZoom,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a><span> | 👨🏼‍💻 </span><a href="https://github.com/fabian-urner">Fabian Urner</a>',
  }
).addTo(map);

// -- Custom Map-Icons:
const iconDefault = L.icon({
  iconUrl: require("./imgs/cbe_maps_icon.png"),
  iconSize: [31, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

const iconAlumni = L.icon({
  iconUrl: require("./imgs/cbe_maps_icon_alumni.png"),
  iconSize: [31, 40],
  iconAnchor: [15, 39],
  popupAnchor: [0, -40],
});

const iconTrainers = L.icon({
  iconUrl: require("./imgs/cbe_maps_icon_trainers.png"),
  iconSize: [31, 40],
  iconAnchor: [15, 39],
  popupAnchor: [0, -40],
});

const iconTeam = L.icon({
  iconUrl: require("./imgs/cbe_maps_icon_team.png"),
  iconSize: [31, 40],
  iconAnchor: [15, 39],
  popupAnchor: [0, -40],
});

// *************
// State
// *************
const state = {
  // selectedUser: null,
  // users: [
  //   {
  //     id: 1,
  //     discord_user_id: "1063050466914730034",
  //     name: "Fite",
  //     avatar_url:
  //       "https://cdn.discordapp.com/avatars/1063050466914730034/f8a1381b97470fb703b2ebff0dd78ec0.webp",
  //     role: "Student",
  //     position: {
  //       lat: 53.574,
  //       lon: 9.977,
  //     },
  //   },
  // ],
};

// *************
// Functions
// *************
async function render(view) {
  userdata.innerHTML = "";
  infoSection.style.visibility = "hidden";

  if (state.selectedUser) {
    map.setView(
      [state.selectedUser.position.lat, state.selectedUser.position.lon],
      17
    );
    infoSection.style.visibility = "visible";
  } else {
    let tempView = { position: DEFAULT_VIEW.position, zoom: DEFAULT_VIEW.zoom };
    if (view) {
      tempView = view;
    }
    map.setView(tempView.position, tempView.zoom);
  }

  //Set all markers on map
  for (const user of state.users) {
    // ---- Set marker on map
    let icon = iconDefault;

    switch (user.role.toLowerCase()) {
      case "alumni":
        icon = iconAlumni;
        break;
      case "trainers":
        icon = iconTrainers;
        break;
      case "cbe-team":
        icon = iconTeam;
        break;
    }

    // Generates UserdataComponent with specific informations to add it to PopUp
    const popUpUserdata = document.createElement("div");
    popUpUserdata.id = "pop-up-user-data";
    popUpUserdata.append(...getTemplateByUser(user));

    const popup = L.popup({
      className: "cbe-popup",
    });

    popup.setContent(popUpUserdata);

    popup.on("remove", () => {
      closeUserInfo();
    });

    const marker = L.marker([user.position.lat, user.position.lon], { icon });

    marker.bindPopup(popup);

    marker.on("click", (e) => {
      state.selectedUser = user;
      render();
    });

    marker.addTo(map);
  }

  if (!state.selectedUser) return;
  userdata.append(...getTemplateByUser(state.selectedUser));
}

function getTemplateByUser(user) {
  const avatar = document.createElement("img");
  const dataContainer = document.createElement("div");
  const name = document.createElement("h2");
  const role = document.createElement("p");
  const discord_chat = document.createElement("a");

  avatar.src = user.avatar_url;

  dataContainer.id = "user-data-container";
  name.textContent = user.name;

  role.textContent = user.role;
  role.classList.add("cbe-role");
  role.classList.add("cbe-role-" + user.role.toLowerCase());

  discord_chat.href = "discord://discordapp.com/users/" + user.discord_user_id;

  const discordLogo = document.createElement("i");
  discordLogo.setAttribute("class", "fa-brands fa-discord");

  discord_chat.append("show profile ");
  discord_chat.append(discordLogo);

  dataContainer.append(name, role, discord_chat);
  return [avatar, dataContainer];
}

async function loadMapData() {
  state.users = await fetch(`${API_ORIGIN}/api/v1/positions`, {
    credentials: "include",
  })
    .then((res) => {
      // if (!res.ok) location.replace(location.origin + "/login.html"); // Redirecting user to login-page if response is not 2XX

      return res.json();
    })
    .then((positions) => {
      return positions;
    });
}

function closeUserInfo() {
  const tempZomm = map.getZoom() < 14 ? map.getZoom() : 14;
  const tempView = { position: state.selectedUser.position, zoom: tempZomm };
  state.selectedUser = null;
  render(tempView);
}

// *************
// Events
// *************
window.onload = async () => {
  //check if code-param set -> user want's to login
  const fragment = new URLSearchParams(window.location.search.slice(1));
  const code = fragment.get("code");

  if (code) {
    await fetch(`${API_ORIGIN}/api/v1/auth?code=${code}`, {
      credentials: "include",
    });
    location.replace(location.origin);
  }

  //load Data and update State
  await loadMapData();

  render();
};

btnCloseInfoSection.addEventListener("click", () => {
  closeUserInfos();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.selectedUser) {
    const tempView = { position: state.selectedUser.position, zoom: 14 };
    state.selectedUser = null;
    render(tempView);
  }
});

btnLogout.addEventListener("click", async () => {
  await fetch(`${API_ORIGIN}/api/v1/logout`, {
    credentials: "include",
  });
  location.replace(location.origin);
});
