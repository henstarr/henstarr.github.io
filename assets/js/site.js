(function () {
  "use strict";
  var script = document.currentScript;
  var url = script.getAttribute("data-supabase-url");
  var key = script.getAttribute("data-supabase-key");
  var sb = window.supabase && url && key ? window.supabase.createClient(url, key) : null;
  window.hsSupabase = sb;
  var session = null;
  var authButton = document.getElementById("site-header-auth");
  authButton.hidden = false;
  var signin = document.getElementById("signin-dialog");
  var account = document.getElementById("account-dialog");

  function closeDialogs() {
    document.querySelectorAll("dialog[open]").forEach(function (dialog) { dialog.close(); });
    document.body.classList.remove("modal-open");
  }
  function openDialog(dialog) {
    closeDialogs();
    dialog.showModal();
    document.body.classList.add("modal-open");
  }
  document.querySelectorAll("dialog").forEach(function (dialog) {
    dialog.addEventListener("close", function () { document.body.classList.remove("modal-open"); });
    dialog.addEventListener("click", function (event) {
      if (event.target.closest("[data-close-dialog]")) dialog.close();
      if (event.target === dialog) {
        var rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
  });
  window.hsOpenSignIn = function () { openDialog(signin); };

  function displayName(user) {
    return (user.user_metadata || {}).display_name || "Reader";
  }
  function renderAuth(current) {
    session = current;
    authButton.textContent = current ? displayName(current.user) : "Sign in";
    authButton.setAttribute("aria-label", current ? "Open account for " + displayName(current.user) : "Sign in");
    window.dispatchEvent(new CustomEvent("hs:auth-change", { detail: { session: current } }));
  }
  authButton.addEventListener("click", function () {
    if (!session) return window.hsOpenSignIn();
    document.getElementById("account-email").textContent = session.user.email;
    document.getElementById("account-name").value = (session.user.user_metadata || {}).display_name || "";
    document.getElementById("account-status").textContent = "";
    openDialog(account);
  });

  document.getElementById("signin-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (!form.reportValidity()) return;
    var status = document.getElementById("signin-status");
    if (!sb) { status.textContent = "Sign in is temporarily unavailable. Please try again later."; return; }
    var button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Sending your link…";
    try {
      var response = await sb.auth.signInWithOtp({ email: document.getElementById("signin-email").value.trim(), options: { emailRedirectTo: window.location.origin + window.location.pathname } });
      if (response.error) throw response.error;
      status.textContent = "Check your inbox for a sign-in link.";
      form.reset();
    } catch (error) { status.textContent = "We couldn’t send the link. Please try again later."; }
    finally { button.disabled = false; }
  });

  document.getElementById("account-name-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!session || !sb) return;
    var input = document.getElementById("account-name");
    input.value = input.value.trim();
    if (!event.currentTarget.reportValidity()) return;
    var button = event.currentTarget.querySelector("button");
    var status = document.getElementById("account-status");
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      var response = await sb.auth.updateUser({ data: { display_name: input.value } });
      if (response.error) throw response.error;
      if (session) renderAuth(Object.assign({}, session, { user: response.data.user }));
      status.textContent = "Display name saved.";
    } catch (error) { status.textContent = "Your name couldn’t be saved. Please try again."; }
    finally { button.disabled = false; }
  });
  document.getElementById("account-signout").addEventListener("click", async function (event) {
    if (!sb) return;
    var button = event.currentTarget;
    button.disabled = true;
    try {
      var response = await sb.auth.signOut();
      if (response.error) throw response.error;
      renderAuth(null);
      closeDialogs();
    } catch (error) { document.getElementById("account-status").textContent = "Sign out failed. Please try again."; }
    finally { button.disabled = false; }
  });
  if (sb) {
    sb.auth.getSession().then(function (response) { renderAuth(response.data.session); }).catch(function () { renderAuth(null); });
    sb.auth.onAuthStateChange(function (event, current) {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") closeDialogs();
      renderAuth(current);
    });
  }
})();
