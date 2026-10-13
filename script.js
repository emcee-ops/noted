const PW_MIN_LENGTH = 8;
const state = { mode: "login", usage: "personal" };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function show(id) {
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

/* ----- Log in / Sign up toggle ----- */
function setMode(mode) {
  state.mode = mode;
  const signup = mode === "signup";
  $$(".signup-only").forEach(el => el.hidden = !signup);
  $$(".login-only").forEach(el => el.hidden = signup);
  $("#authSubmit").textContent = signup ? "Sign up" : "Log in";
  $("#switchText").innerHTML = signup
    ? 'Already have an account? <a data-mode="login">Log in</a>'
    : 'Don\'t have an account yet? <a data-mode="signup">Sign up now<i>!</i></a>';
  $$(".error").forEach(e => e.textContent = "");
  updatePwRules();
}
$("#switchText").addEventListener("click", e => {
  const a = e.target.closest("a[data-mode]");
  if (a) setMode(a.dataset.mode);
});
/* hoisted helper needed by setMode before the rules section is defined */
function updatePwRules() {
  const r = checkPassword($("#pw").value);
  $$("#pwRules li").forEach(li => li.classList.toggle("met", r[li.dataset.rule]));
}
setMode("login");

/* ----- Show / hide password ----- */
$$(".eye").forEach(btn => btn.addEventListener("click", () => {
  const input = document.getElementById(btn.dataset.target);
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.classList.toggle("is-shown", show);
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
}));

/* ----- Password rules ----- */
function checkPassword(pw) {
  return {
    length: pw.length >= PW_MIN_LENGTH,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    special: /[^A-Za-z0-9\s]/.test(pw)
  };
}
$("#pw").addEventListener("input", updatePwRules);

/* ----- Validation + submit ----- */
$("#authForm").addEventListener("submit", e => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const pw = $("#pw").value;
  const pw2 = $("#pw2").value;
  let ok = true;

  $("#emailErr").textContent = /^\S+@\S+\.\S+$/.test(email) ? "" : (ok = false, "Enter a valid email address.");
  if (state.mode === "signup") {
    const r = checkPassword(pw);
    if (!(r.length && r.lower && r.upper && r.special)) {
      $("#pwErr").textContent = "Password doesn't meet all the requirements.";
      ok = false;
    } else {
      $("#pwErr").textContent = "";
    }
  } else {
    $("#pwErr").textContent = pw ? "" : (ok = false, "Enter your password.");
  }
  $("#pw2Err").textContent = "";
  if (state.mode === "signup" && pw !== pw2) {
    $("#pw2Err").textContent = "Passwords don't match.";
    ok = false;
  }
  if (!ok) return;

  if (state.mode === "signup") {
    const name = email.split("@")[0];
    $("#first").value = name.charAt(0).toUpperCase() + name.slice(1);
    $("#last").value = "";
    updateAvatar();
    show("step1");
  } else {
    alert("Logged in! Send the user to the dashboard here.");
  }
});

/* ----- Step 1: avatar follows first name ----- */
function updateAvatar() {
  const f = $("#first").value.trim();
  $("#avatar").textContent = f ? f[0].toUpperCase() : "?";
}
$("#first").addEventListener("input", updateAvatar);

/* ----- Next buttons ----- */
$$("[data-go]").forEach(btn => btn.addEventListener("click", () => show(btn.dataset.go)));

/* ----- Step 2: pick one option ----- */
$("#options").addEventListener("click", e => {
  const opt = e.target.closest(".option");
  if (!opt) return;
  $$(".option").forEach(o => o.classList.toggle("selected", o === opt));
  state.usage = opt.dataset.value;
});

/* ----- Step 3: finish ----- */
$("#done").addEventListener("click", () => {
  console.log("Onboarding complete:", {
    firstName: $("#first").value,
    lastName: $("#last").value,
    usage: state.usage
  });
  alert("Onboarding complete! Redirect to the dashboard here.");
});


/* ----- Continue with Google ----- */
/* Authorized JavaScript origins in Google Cloud Console must include
   https://kenmwah.github.io (and http://localhost:5500 for local testing). */
const GOOGLE_CLIENT_ID = "463377629457-r8r0c6pg86748tn81a0bmrpr6m287pvc.apps.googleusercontent.com";
let googleClient = null;

function googleError(msg) { $("#googleErr").textContent = msg; }

function getGoogleClient() {
  if (googleClient) return googleClient;
  if (!(window.google && google.accounts && google.accounts.oauth2)) return null;
  googleClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    callback: onGoogleToken,
    error_callback: err => {
      if (err && err.type === "popup_closed") return;
      googleError("Google sign-in failed. Please try again.");
    }
  });
  return googleClient;
}

async function onGoogleToken(resp) {
  if (!resp || resp.error) { googleError("Google sign-in failed. Please try again."); return; }
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + resp.access_token }
    });
    if (!res.ok) throw new Error(res.status);
    const user = await res.json();   // { email, given_name, family_name, picture, ... }
    googleError("");
    if (state.mode === "signup") {
      $("#first").value = user.given_name || (user.email || "").split("@")[0];
      $("#last").value = user.family_name || "";
      updateAvatar();
      show("step1");
    } else {
      alert("Logged in as " + user.email + "! Send the user to the dashboard here.");
    }
  } catch (err) {
    googleError("Couldn't get your Google profile. Please try again.");
  }
}

$(".btn-google").addEventListener("click", () => {
  googleError("");
  if (GOOGLE_CLIENT_ID.startsWith("YOUR_CLIENT_ID")) {
    googleError("Google sign-in isn't set up yet: add your Client ID in script.js.");
    return;
  }
  const client = getGoogleClient();
  if (!client) { googleError("Google sign-in is still loading or was blocked. Check your connection and try again."); return; }
  client.requestAccessToken();
});
