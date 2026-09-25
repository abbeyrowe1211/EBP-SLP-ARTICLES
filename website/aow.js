(function () {
  // Mirrors src/services/articleOfWeekService.ts getArticleOfWeek() exactly,
  // so the website always agrees with the app on which article is featured —
  // no manual updates, no redeploys, it just tracks the same live data.
  var AOW_URL = 'https://raw.githubusercontent.com/abbeyrowe1211/EBP-SLP-ARTICLES/main/articles.json';
  var PAST_WEEKS = 3;
  var EV_SCORE = { '1a': 4, '1b': 3, '2': 2, '3': 1 };

  function scoreArticle(a, curYear) {
    var ev = EV_SCORE.hasOwnProperty(a.evidenceLevel) ? EV_SCORE[a.evidenceLevel] : 1;
    return ev * 3 + Math.max(0, 3 - Math.floor((curYear - a.year) / 5));
  }

  function topPool(articles) {
    var curYear = new Date().getFullYear();
    var eligible = articles.filter(function (a) { return a.isTreatmentFocused !== false; });
    var scored = eligible.map(function (a) { return { article: a, score: scoreArticle(a, curYear) }; });
    scored.sort(function (x, y) { return y.score - x.score; });
    return scored.slice(0, 24).map(function (s) { return s.article; });
  }

  function weekIndex(offset) {
    var daysSinceEpoch = Math.floor(Date.now() / 86400000);
    return Math.floor((daysSinceEpoch + 3) / 7) + offset;
  }

  function articleForOffset(pool, offset) {
    if (!pool.length) return null;
    var idx = weekIndex(offset);
    return pool[((idx % pool.length) + pool.length) % pool.length];
  }

  function mondayLabel(offset) {
    var thisWeekIdx = weekIndex(0);
    var mondayEpochDay = (thisWeekIdx + offset) * 7 - 3;
    var d = new Date(mondayEpochDay * 86400000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function firstSentence(text) {
    if (!text) return '';
    var m = String(text).match(/^.*?[.!?](?=\s|$)/);
    return (m ? m[0] : text).trim();
  }

  function articleLink(a) {
    if (a.pmid) return 'https://pubmed.ncbi.nlm.nih.gov/' + a.pmid + '/';
    if (a.url) return a.url;
    return null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderCurrent(article) {
    var el = document.getElementById('aow-current');
    if (!el) return;
    if (!article) {
      el.innerHTML = '<p class="aow-skeleton">Check back soon for this week\'s featured article.</p>';
      return;
    }
    var link = articleLink(article);
    el.innerHTML =
      '<h2>' + escapeHtml(article.shortTitle || article.title) + '</h2>' +
      '<p>' + escapeHtml(firstSentence(article.summary)) + '</p>' +
      '<div class="aow-actions">' +
        (link ? '<a class="aow-link" href="' + link + '" target="_blank" rel="noopener">Read the full article &rarr;</a>' : '') +
        '<a class="aow-link" href="index.html#store-cta">See more in the app &rarr;</a>' +
      '</div>';
  }

  function renderArchive(pool) {
    var list = document.getElementById('aow-archive-list');
    if (!list) return;
    var html = '';
    for (var i = 1; i <= PAST_WEEKS; i++) {
      var a = articleForOffset(pool, -i);
      if (!a) continue;
      var link = articleLink(a);
      var title = escapeHtml(a.shortTitle || a.title);
      html += '<li>' +
        '<span class="aow-archive-date">' + mondayLabel(-i) + '</span>' +
        '<span class="aow-archive-title">' + (link ? '<a href="' + link + '" target="_blank" rel="noopener">' + title + '</a>' : title) + '</span>' +
      '</li>';
    }
    list.innerHTML = html || '<li class="aow-skeleton" style="border-top:none;">Nothing to show yet.</li>';
  }

  fetch(AOW_URL, { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (articles) {
      var pool = topPool(articles);
      renderCurrent(articleForOffset(pool, 0));
      renderArchive(pool);
    })
    .catch(function () {
      renderCurrent(null);
      var list = document.getElementById('aow-archive-list');
      if (list) list.innerHTML = '<li class="aow-skeleton" style="border-top:none;">Couldn\'t load past articles right now.</li>';
    });
})();
