(function () {
  var script = document.currentScript;
  var supabaseUrl = script.getAttribute("data-supabase-url");
  var supabaseKey = script.getAttribute("data-supabase-key");

  var form = document.getElementById("subscribe-form");
  if (!form || !supabaseUrl || !supabaseKey) return;

  var input = document.getElementById("subscribe-email");
  var status = document.getElementById("subscribe-status");
  var button = form.querySelector("button");

  function setStatus(message, state) {
    status.textContent = message;
    if (state) {
      status.setAttribute("data-state", state);
    } else {
      status.removeAttribute("data-state");
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = input.value.trim();
    if (!email) return;

    button.disabled = true;
    setStatus("Subscribing…", null);

    fetch(supabaseUrl + "/rest/v1/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ email: email })
    })
      .then(function (response) {
        if (response.status === 201) {
          setStatus("Subscribed — thanks.", "ok");
          form.reset();
        } else if (response.status === 409) {
          setStatus("That email is already subscribed.", "ok");
        } else {
          setStatus("Something went wrong — try again.", "error");
        }
      })
      .catch(function () {
        setStatus("Something went wrong — try again.", "error");
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
