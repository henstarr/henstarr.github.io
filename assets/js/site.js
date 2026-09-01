(function () {
  var script = document.currentScript;
  var SUPABASE_URL = script.getAttribute("data-supabase-url");
  var SUPABASE_KEY = script.getAttribute("data-supabase-key");

  if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) return;

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.hsSupabase = sb;

  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = false;
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  window.hsOpenSignIn = function () {
    closeModal("intro-overlay");
    openModal("signin-overlay");
  };

  document.addEventListener("click", function (e) {
    if (e.target.id === "signin-close" || e.target.id === "signin-overlay") closeModal("signin-overlay");
    if (e.target.id === "intro-close" || e.target.id === "intro-overlay") closeModal("intro-overlay");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal("signin-overlay");
      closeModal("intro-overlay");
    }
  });

  var introLink = document.getElementById("intro-signin-link");
  if (introLink) {
    introLink.addEventListener("click", function (e) {
      e.preventDefault();
      window.hsOpenSignIn();
    });
  }

  // ---- Sign-in form (magic link) ----
  var signinForm = document.getElementById("signin-form");
  if (signinForm) {
    signinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("signin-email").value.trim();
      var status = document.getElementById("signin-status");
      var button = signinForm.querySelector("button");
      if (!email) return;
      button.disabled = true;
      status.textContent = "Sending…";
      sb.auth
        .signInWithOtp({ email: email, options: { emailRedirectTo: window.location.href } })
        .then(function (res) {
          status.textContent = res.error
            ? "Something went wrong — try again."
            : "Check your email for a sign-in link.";
          if (!res.error) signinForm.reset();
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  // ---- Intro modal: subscribe form (writes to the public subscribers list) ----
  var introForm = document.getElementById("intro-subscribe-form");
  if (introForm) {
    introForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("intro-email").value.trim();
      var status = document.getElementById("intro-status");
      var button = introForm.querySelector("button");
      if (!email) return;
      button.disabled = true;
      status.textContent = "Subscribing…";
      fetch(SUPABASE_URL + "/rest/v1/subscribers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ email: email })
      })
        .then(function (response) {
          if (response.status === 201) {
            status.textContent = "Subscribed — thanks.";
            introForm.reset();
          } else if (response.status === 409) {
            status.textContent = "You're already subscribed.";
          } else {
            status.textContent = "Something went wrong — try again.";
          }
        })
        .catch(function () {
          status.textContent = "Something went wrong — try again.";
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  // ---- First-visit "discover" modal ----
  var INTRO_KEY = "hs_intro_seen";
  try {
    if (!localStorage.getItem(INTRO_KEY)) {
      setTimeout(function () {
        openModal("intro-overlay");
        localStorage.setItem(INTRO_KEY, "1");
      }, 1200);
    }
  } catch (e) {}

  // ---- Header auth state ----
  var headerAuthLink = document.getElementById("site-header-auth");
  function renderAuthState(session) {
    if (!headerAuthLink) return;
    if (session && session.user) {
      headerAuthLink.textContent = "Sign out";
      headerAuthLink.onclick = function (e) {
        e.preventDefault();
        sb.auth.signOut();
      };
    } else {
      headerAuthLink.textContent = "Sign in";
      headerAuthLink.onclick = function (e) {
        e.preventDefault();
        window.hsOpenSignIn();
      };
    }
  }

  sb.auth.getSession().then(function (res) {
    renderAuthState(res.data.session);
  });
  sb.auth.onAuthStateChange(function (_event, session) {
    renderAuthState(session);
    if (session) closeModal("signin-overlay");
    window.dispatchEvent(new CustomEvent("hs:auth-change", { detail: { session: session } }));
  });
})();
