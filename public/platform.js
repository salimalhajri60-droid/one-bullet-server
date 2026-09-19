// Optional CrazyGames v3 integration. Standalone play never waits for an SDK.
// Enable ONE_BULLET_CRAZYGAMES in config.js for the portal build.
let sdk = null,
  playing = false,
  lastRoom = "",
  muted = false;
const listeners = [];
export const platform = {
  get muted() {
    return muted;
  },
  async init() {
    if (!window.ONE_BULLET_CRAZYGAMES) return;
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      await window.CrazyGames.SDK.init();
      sdk = window.CrazyGames.SDK;
      muted = !!sdk.game.settings.muteAudio;
      sdk.game.addSettingsChangeListener((s) => {
        muted = !!s.muteAudio;
      });
      sdk.game.addJoinRoomListener((params) =>
        listeners.forEach((fn) => fn(params)),
      );
      sdk.game.loadingStart();
      await document.fonts.ready;
      await new Promise((resolve) => {
        const art = new Image();
        art.onload = resolve;
        art.onerror = resolve;
        art.src = "menu-art.png";
      });
      sdk.game.loadingStop();
      if (sdk.game.inviteParams)
        listeners.forEach((fn) => fn(sdk.game.inviteParams));
      else if (sdk.game.isInstantMultiplayer)
        listeners.forEach((fn) => fn({ instant: true }));
    } catch (e) {
      console.info(
        "CrazyGames integration unavailable; standalone mode remains playable.",
      );
    }
  },
  onInvite(fn) {
    listeners.push(fn);
  },
  gameplay(active) {
    if (!sdk || playing === active) return;
    playing = active;
    try {
      sdk.game[active ? "gameplayStart" : "gameplayStop"]();
    } catch {}
  },
  room(lobby) {
    if (!sdk) return;
    try {
      if (!lobby) {
        if (lastRoom) sdk.game.leftRoom();
        lastRoom = "";
        return;
      }
      lastRoom = lobby.code;
      sdk.game.updateRoom({
        roomId: lobby.code,
        isJoinable:
          lobby.kind === "private" &&
          lobby.status === "lobby" &&
          lobby.players.length < 8,
        inviteParams: { roomCode: lobby.code },
      });
    } catch {}
  },
  celebrate() {
    try {
      sdk?.game.happytime();
    } catch {}
  },
};
