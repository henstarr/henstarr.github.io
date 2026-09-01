(function () {
  var root = document.getElementById("engagement");
  if (!root || !window.hsSupabase) return;

  var sb = window.hsSupabase;
  var slug = root.getAttribute("data-post-slug");

  var likeButton = document.getElementById("like-button");
  var likeCountEl = document.getElementById("like-count");
  var viewCountEl = document.getElementById("view-count");
  var commentCountEl = document.getElementById("comment-count");
  var commentList = document.getElementById("comment-list");
  var commentForm = document.getElementById("comment-form");
  var commentSigninPrompt = document.getElementById("comment-signin-prompt");
  var commentBody = document.getElementById("comment-body");

  var session = null;
  var liked = false;

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderComments(rows) {
    commentCountEl.textContent = rows.length;
    commentList.innerHTML = rows
      .map(function (c) {
        var date = new Date(c.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
        var canDelete = session && session.user && session.user.id === c.user_id;
        return (
          '<li class="comment-item">' +
          '<div class="comment-item-head"><span class="comment-author">' +
          escapeHtml(c.author_name) +
          '</span><span class="comment-date">' +
          date +
          "</span>" +
          (canDelete
            ? '<button type="button" class="comment-delete" data-comment-id="' + c.id + '">Delete</button>'
            : "") +
          "</div>" +
          '<p class="comment-body">' +
          escapeHtml(c.body) +
          "</p></li>"
        );
      })
      .join("");
  }

  function loadComments() {
    sb.from("comments")
      .select("*")
      .eq("post_slug", slug)
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.data) renderComments(res.data);
      });
  }

  function loadLikes() {
    sb.from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_slug", slug)
      .then(function (res) {
        likeCountEl.textContent = res.count || 0;
      });

    if (session) {
      sb.from("likes")
        .select("post_slug")
        .eq("post_slug", slug)
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(function (res) {
          liked = !!res.data;
          likeButton.setAttribute("aria-pressed", liked ? "true" : "false");
          likeButton.classList.toggle("is-liked", liked);
        });
    } else {
      liked = false;
      likeButton.setAttribute("aria-pressed", "false");
      likeButton.classList.remove("is-liked");
    }
  }

  function loadViews() {
    var VIEW_KEY = "hs_viewed_" + slug;
    var alreadyCounted = false;
    try {
      alreadyCounted = !!sessionStorage.getItem(VIEW_KEY);
    } catch (e) {}

    if (!alreadyCounted) {
      sb.rpc("increment_post_view", { p_slug: slug }).then(function (res) {
        if (typeof res.data === "number") viewCountEl.textContent = res.data;
        try {
          sessionStorage.setItem(VIEW_KEY, "1");
        } catch (e) {}
      });
    } else {
      sb.from("post_views")
        .select("view_count")
        .eq("post_slug", slug)
        .maybeSingle()
        .then(function (res) {
          viewCountEl.textContent = (res.data && res.data.view_count) || 0;
        });
    }
  }

  function updateCommentGate() {
    if (session) {
      commentForm.hidden = false;
      commentSigninPrompt.hidden = true;
    } else {
      commentForm.hidden = true;
      commentSigninPrompt.hidden = false;
    }
  }

  likeButton.addEventListener("click", function () {
    if (!session) {
      window.hsOpenSignIn();
      return;
    }
    likeButton.disabled = true;
    var action = liked
      ? sb.from("likes").delete().eq("post_slug", slug).eq("user_id", session.user.id)
      : sb.from("likes").insert({ post_slug: slug, user_id: session.user.id });
    action
      .then(function () {
        loadLikes();
      })
      .finally(function () {
        likeButton.disabled = false;
      });
  });

  commentSigninPrompt.addEventListener("click", function () {
    window.hsOpenSignIn();
  });

  commentList.addEventListener("click", function (e) {
    if (!e.target.classList.contains("comment-delete")) return;
    if (!session) return;
    if (!window.confirm("Delete this comment?")) return;
    var id = e.target.getAttribute("data-comment-id");
    e.target.disabled = true;
    sb.from("comments")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id)
      .then(function () {
        loadComments();
      });
  });

  commentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!session) {
      window.hsOpenSignIn();
      return;
    }
    var body = commentBody.value.trim();
    if (!body) return;
    var button = commentForm.querySelector("button");
    button.disabled = true;
    var meta = session.user.user_metadata || {};
    var authorName = meta.display_name || (session.user.email || "Reader").split("@")[0];
    sb.from("comments")
      .insert({ post_slug: slug, user_id: session.user.id, author_name: authorName, body: body })
      .then(function (res) {
        if (!res.error) {
          commentBody.value = "";
          loadComments();
        }
      })
      .finally(function () {
        button.disabled = false;
      });
  });

  function init(currentSession) {
    session = currentSession;
    updateCommentGate();
    loadLikes();
    loadComments();
  }

  sb.auth.getSession().then(function (res) {
    init(res.data.session);
  });
  window.addEventListener("hs:auth-change", function (e) {
    init(e.detail.session);
  });

  loadViews();
})();
