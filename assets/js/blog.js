(function () {
  "use strict";

  var archive = document.querySelector("[data-archive]");
  if (archive) {
    var form = archive.querySelector("form");
    var search = document.getElementById("archive-search");
    var topic = document.getElementById("archive-topic");
    var count = document.getElementById("archive-count");
    var empty = document.getElementById("archive-empty");
    var posts = Array.from(archive.querySelectorAll(".post-entry")).map(function (element) {
      return { element: element, text: normalize(element.dataset.search), topics: JSON.parse(element.dataset.topics || "[]") };
    });
    function normalize(value) {
      return (value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }
    function filter(updateUrl) {
      var terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      var visible = 0;
      posts.forEach(function (post) {
        var matches = terms.every(function (term) { return post.text.includes(term); }) && (!topic.value || post.topics.includes(topic.value));
        post.element.hidden = !matches;
        if (matches) visible++;
      });
      archive.querySelectorAll("[data-year]").forEach(function (year) {
        year.hidden = !year.querySelector(".post-entry:not([hidden])");
      });
      count.textContent = visible + (visible === 1 ? " post" : " posts") + (terms.length || topic.value ? " found" : "");
      empty.hidden = visible > 0;
      if (updateUrl) {
        var url = new URL(window.location.href);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim()); else url.searchParams.delete("q");
        if (topic.value) url.searchParams.set("topic", topic.value); else url.searchParams.delete("topic");
        window.history.replaceState(null, "", url);
      }
    }
    function readUrl() {
      var params = new URLSearchParams(window.location.search);
      search.value = params.get("q") || "";
      topic.value = params.get("topic") || "";
      if (topic.selectedIndex < 0) topic.value = "";
      filter(false);
    }
    form.hidden = false;
    form.addEventListener("submit", function (event) { event.preventDefault(); filter(true); });
    search.addEventListener("input", function () { filter(true); });
    topic.addEventListener("change", function () { filter(true); });
    document.getElementById("archive-reset").addEventListener("click", function () {
      search.value = "";
      topic.value = "";
      filter(true);
      search.focus();
    });
    window.addEventListener("popstate", readUrl);
    readUrl();
  }

  var toc = document.querySelector("[data-toc]");
  var headings = document.querySelectorAll(".post .post-content h2");
  if (toc && headings.length > 1) {
    headings.forEach(function (heading, index) {
      if (!heading.id) heading.id = "section-" + (index + 1);
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      item.appendChild(link);
      toc.querySelector("ol").appendChild(item);
    });
    toc.hidden = false;
  }

  var copy = document.querySelector("[data-copy-link]");
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener("click", async function () {
      var status = document.getElementById("copy-status");
      try {
        var canonical = document.querySelector('link[rel="canonical"]');
        await navigator.clipboard.writeText(canonical ? canonical.href : window.location.href.split("#")[0]);
        status.textContent = "Link copied to clipboard.";
        copy.textContent = "Link copied ✓";
        window.setTimeout(function () { copy.textContent = "Copy link ↗"; }, 2500);
      } catch (error) {
        status.textContent = "The link could not be copied. You can copy the address from your browser.";
      }
    });
  }
})();
