(function () {
  "use strict";
  var root = document.getElementById("engagement");
  if (!root) return;
  var status = document.getElementById("engagement-status");
  status.textContent = "Loading the conversation…";
  var sb = window.hsSupabase;
  if (!sb) { status.textContent = "The conversation is temporarily unavailable. You can still reach me using the Email link below."; return; }
  var slug = root.dataset.postSlug;
  var likeButton = document.getElementById("like-button");
  var likeCount = document.getElementById("like-count");
  var commentCount = document.getElementById("comment-count");
  var commentList = document.getElementById("comment-list");
  var form = document.getElementById("comment-form");
  var prompt = document.getElementById("comment-signin-prompt");
  var body = document.getElementById("comment-body");
  var session = null;
  var liked = false;
  var generation = 0;

  function renderComments(rows) {
    commentCount.textContent = "(" + rows.length + ")";
    commentList.replaceChildren();
    rows.forEach(function (comment) {
      var item = document.createElement("li");
      item.className = "comment-item";
      var head = document.createElement("div");
      head.className = "comment-item-head";
      var author = document.createElement("span");
      author.className = "comment-author";
      author.textContent = comment.author_name || "Reader";
      var date = document.createElement("time");
      date.className = "comment-date";
      date.dateTime = comment.created_at;
      date.textContent = new Date(comment.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      head.append(author, date);
      if (session && session.user.id === comment.user_id) {
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "comment-delete";
        remove.dataset.commentId = comment.id;
        remove.textContent = "Delete";
        remove.setAttribute("aria-label", "Delete your comment from " + date.textContent);
        head.appendChild(remove);
      }
      var text = document.createElement("p");
      text.className = "comment-body";
      text.textContent = comment.body;
      item.append(head, text);
      commentList.appendChild(item);
    });
  }
  async function loadComments(version) {
    var response = await sb.from("comments").select("id,author_name,body,created_at,user_id").eq("post_slug", slug).order("created_at", { ascending: true });
    if (response.error) throw response.error;
    if (version !== generation) return;
    renderComments(response.data || []);
    status.textContent = (response.data || []).length ? "" : "No comments yet. There’s room for your thoughts.";
  }
  async function loadLikes(version) {
    var response = await sb.from("likes").select("post_slug", { count: "exact", head: true }).eq("post_slug", slug);
    if (response.error) throw response.error;
    if (version !== generation) return;
    likeCount.textContent = response.count || 0;
    liked = false;
    if (session) {
      var own = await sb.from("likes").select("post_slug").eq("post_slug", slug).eq("user_id", session.user.id).maybeSingle();
      if (own.error) throw own.error;
      if (version !== generation) return;
      liked = !!own.data;
    }
    likeButton.setAttribute("aria-pressed", String(liked));
    likeButton.setAttribute("aria-label", liked ? "Unlike this post" : "Like this post");
    likeButton.classList.toggle("is-liked", liked);
    likeButton.disabled = false;
  }
  async function refresh(current) {
    session = current;
    var version = ++generation;
    form.hidden = !current;
    prompt.hidden = !!current;
    try { await Promise.all([loadLikes(version), loadComments(version)]); }
    catch (error) { if (version === generation) status.textContent = "The conversation couldn’t be loaded. Please try again later or use the Email link below."; }
  }
  likeButton.addEventListener("click", async function () {
    if (!session) return window.hsOpenSignIn();
    likeButton.disabled = true;
    try {
      var response = liked
        ? await sb.from("likes").delete().eq("post_slug", slug).eq("user_id", session.user.id)
        : await sb.from("likes").insert({ post_slug: slug, user_id: session.user.id });
      if (response.error) throw response.error;
      await loadLikes(generation);
    } catch (error) { status.textContent = "Your like couldn’t be saved. Please try again."; }
    finally { likeButton.disabled = false; }
  });
  prompt.addEventListener("click", function () { window.hsOpenSignIn(); });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!session) return window.hsOpenSignIn();
    body.value = body.value.trim();
    if (!form.reportValidity()) return;
    var button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Posting your comment…";
    try {
      var response = await sb.from("comments").insert({ post_slug: slug, user_id: session.user.id, author_name: (session.user.user_metadata || {}).display_name || "Reader", body: body.value });
      if (response.error) throw response.error;
      body.value = "";
      await loadComments(generation);
      status.textContent = "Your comment was posted.";
    } catch (error) { status.textContent = "Your comment couldn’t be posted. Your text is still here; please try again."; }
    finally { button.disabled = false; }
  });
  commentList.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-comment-id]");
    if (!button || !session || !window.confirm("Delete your comment?")) return;
    button.disabled = true;
    try {
      var response = await sb.from("comments").delete().eq("id", button.dataset.commentId).eq("user_id", session.user.id);
      if (response.error) throw response.error;
      await loadComments(generation);
      status.textContent = "Your comment was deleted.";
    } catch (error) { status.textContent = "Your comment couldn’t be deleted. Please try again."; }
    finally { button.disabled = false; }
  });
  window.addEventListener("hs:auth-change", function (event) { refresh(event.detail.session); });
  sb.auth.getSession().then(function (response) { refresh(response.data.session); }).catch(function () { refresh(null); });

})();
