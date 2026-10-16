(function () {
  "use strict";
  var script = document.currentScript;
  var url = script.getAttribute("data-supabase-url");
  var key = script.getAttribute("data-supabase-key");
  var form = document.getElementById("subscribe-form");
  if (!form) return;
  form.hidden = false;
  var input = document.getElementById("subscribe-email");
  var status = document.getElementById("subscribe-status");
  var button = form.querySelector("button");
  var sb = window.hsSupabase;
  var confirming = new URLSearchParams(window.location.search).get("subscribe") === "1";

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "";
  }
  function setButtonLabel(text) {
    var arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    button.replaceChildren(document.createTextNode(text + " "), arrow);
  }
  function showConfirmation(session) {
    if (confirming && session && session.user) {
      input.value = session.user.email;
      setButtonLabel("Confirm subscription");
      setStatus("Your email is verified. Select Confirm subscription to join the list.");
      document.getElementById("subscribe").scrollIntoView();
    }
  }
  if (sb) {
    sb.auth.getSession().then(function (response) { showConfirmation(response.data.session); }).catch(function () {});
    window.addEventListener("hs:auth-change", function (event) { showConfirmation(event.detail.session); });
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    input.value = input.value.trim();
    if (!form.reportValidity() || button.disabled) return;
    if (!sb || !url || !key) { setStatus("The list is temporarily unavailable. Please try again later.", "error"); return; }
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 15000);
    try {
      var current = await sb.auth.getSession();
      if (current.error) throw current.error;
      var session = current.data.session;
      if (!session || session.user.email.toLowerCase() !== input.value.toLowerCase()) {
        setStatus("Sending your verification link…");
        var redirect = new URL(window.location.origin + window.location.pathname);
        redirect.searchParams.set("subscribe", "1");
        var verification = await sb.auth.signInWithOtp({ email: input.value.toLowerCase(), options: { emailRedirectTo: redirect.href } });
        if (verification.error) throw verification.error;
        setStatus("Check your email for a verification link. Open it, then confirm your subscription on this page.", "ok");
        return;
      }
      setStatus("Saving your email…");
      var response = await fetch(url + "/rest/v1/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + session.access_token, Prefer: "return=minimal" },
        body: JSON.stringify({ email: session.user.email }),
        signal: controller.signal
      });
      if (response.status === 201 || response.status === 409) {
        setStatus(response.status === 201 ? "You’re on the list. Thanks for following along!" : "You’re already on the list. Thanks for being here!", "ok");
        if (confirming) {
          var location = new URL(window.location.href);
          location.searchParams.delete("subscribe");
          window.history.replaceState(null, "", location);
          confirming = false;
        }
        setButtonLabel("Subscribe");
        form.reset();
      } else throw new Error("Subscription failed");
    } catch (error) { setStatus("We couldn’t complete your subscription. Please try again or use the Email link below.", "error"); }
    finally { window.clearTimeout(timer); button.disabled = false; form.removeAttribute("aria-busy"); }
  });
})();
