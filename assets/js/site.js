(function () {
  var script = document.currentScript;
  var SUPABASE_URL = script.getAttribute("data-supabase-url");
  var SUPABASE_KEY = script.getAttribute("data-supabase-key");

  if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) return;

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.hsSupabase = sb;

  var currentSession = null;

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
    closeModal("postsignin-overlay");
    openModal("signin-overlay");
  };

  document.addEventListener("click", function (e) {
    if (e.target.id === "signin-close" || e.target.id === "signin-overlay") closeModal("signin-overlay");
    if (e.target.id === "intro-close" || e.target.id === "intro-overlay") closeModal("intro-overlay");
    if (e.target.id === "postsignin-close" || e.target.id === "postsignin-overlay") closeModal("postsignin-overlay");
    if (e.target.id === "account-close" || e.target.id === "account-overlay") closeModal("account-overlay");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal("signin-overlay");
      closeModal("intro-overlay");
      closeModal("postsignin-overlay");
      closeModal("account-overlay");
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

  // ---- Shared "add to subscribers list" call ----
  function submitSubscribeEmail(email, status, button, onDone) {
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
          if (onDone) onDone();
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
  }

  var introForm = document.getElementById("intro-subscribe-form");
  if (introForm) {
    introForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("intro-email").value.trim();
      if (!email) return;
      submitSubscribeEmail(
        email,
        document.getElementById("intro-status"),
        introForm.querySelector("button"),
        function () {
          introForm.reset();
        }
      );
    });
  }

  var postsigninButton = document.getElementById("postsignin-subscribe-button");
  if (postsigninButton) {
    postsigninButton.addEventListener("click", function () {
      if (!currentSession || !currentSession.user) return;
      submitSubscribeEmail(currentSession.user.email, document.getElementById("postsignin-status"), postsigninButton);
    });
  }

  // ---- First-visit "discover" modal ----
  var INTRO_KEY = "hs_intro_seen";
  var introTimer = null;
  try {
    if (!localStorage.getItem(INTRO_KEY)) {
      introTimer = setTimeout(function () {
        openModal("intro-overlay");
        localStorage.setItem(INTRO_KEY, "1");
      }, 1200);
    }
  } catch (e) {}

  // ---- Post-sign-in "subscribe by email" modal ----
  var POSTSIGNIN_KEY = "hs_postsignin_prompt_seen";
  function maybePromptSubscribeAfterSignIn(session) {
    var overlay = document.getElementById("postsignin-overlay");
    if (!overlay || !session || !session.user) return;
    var seen = true;
    try {
      seen = !!localStorage.getItem(POSTSIGNIN_KEY);
    } catch (e) {}
    if (seen) return;
    try {
      localStorage.setItem(POSTSIGNIN_KEY, "1");
    } catch (e) {}

    if (introTimer) {
      clearTimeout(introTimer);
      introTimer = null;
    }
    closeModal("intro-overlay");
    closeModal("signin-overlay");

    var sub = document.getElementById("postsignin-sub");
    if (sub && session.user.email) sub.textContent = "Send new posts to " + session.user.email + "?";
    openModal("postsignin-overlay");
  }

  // ---- Display name helper ----
  function displayNameFor(session) {
    if (!session || !session.user) return "";
    var meta = session.user.user_metadata || {};
    return meta.display_name || (session.user.email || "").split("@")[0];
  }

  // ---- Header auth state + account modal ----
  var headerAuthLink = document.getElementById("site-header-auth");

  function openAccountModal() {
    if (!currentSession) return;
    var emailEl = document.getElementById("account-email");
    var nameInput = document.getElementById("account-name");
    if (emailEl) emailEl.textContent = currentSession.user.email;
    if (nameInput) nameInput.value = displayNameFor(currentSession);
    var status = document.getElementById("account-status");
    if (status) status.textContent = "";
    openModal("account-overlay");
  }

  function renderAuthState(session) {
    currentSession = session;
    if (!headerAuthLink) return;
    if (session && session.user) {
      headerAuthLink.textContent = displayNameFor(session);
      headerAuthLink.onclick = function (e) {
        e.preventDefault();
        openAccountModal();
      };
    } else {
      headerAuthLink.textContent = "Sign in";
      headerAuthLink.onclick = function (e) {
        e.preventDefault();
        window.hsOpenSignIn();
      };
    }
  }

  var accountNameForm = document.getElementById("account-name-form");
  if (accountNameForm) {
    accountNameForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!currentSession) return;
      var name = document.getElementById("account-name").value.trim();
      var status = document.getElementById("account-status");
      var button = accountNameForm.querySelector("button");
      button.disabled = true;
      status.textContent = "Saving…";
      sb.auth
        .updateUser({ data: { display_name: name } })
        .then(function (res) {
          if (res.error) {
            status.textContent = "Something went wrong — try again.";
            return;
          }
          status.textContent = "Saved.";
          if (res.data && res.data.user) {
            currentSession.user = res.data.user;
            headerAuthLink.textContent = displayNameFor(currentSession);
          }
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  var accountSignout = document.getElementById("account-signout");
  if (accountSignout) {
    accountSignout.addEventListener("click", function () {
      sb.auth.signOut();
      closeModal("account-overlay");
    });
  }

  sb.auth.getSession().then(function (res) {
    renderAuthState(res.data.session);
  });
  sb.auth.onAuthStateChange(function (event, session) {
    renderAuthState(session);
    if (session) closeModal("signin-overlay");
    else closeModal("account-overlay");
    if (event === "SIGNED_IN") maybePromptSubscribeAfterSignIn(session);
    window.dispatchEvent(new CustomEvent("hs:auth-change", { detail: { session: session } }));
  });
})();
