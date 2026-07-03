/**
 * Changelog fetcher and modal logic
 */
import { $, $$ } from './utils.js';

const WORKER_URL = 'https://gh-commit-api.york.qzz.io/';

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

export async function initChangelog() {
  const commitInfo = $('#commit-info');
  const commitLink = $('#commit-link');
  const modal = $('#changelog-modal');
  const closeBtn = $('#changelog-close');
  const backdrop = $('#changelog-backdrop');
  const list = $('#changelog-list');
  const pagination = $('#changelog-pagination');
  const prevBtn = $('#changelog-prev');
  const nextBtn = $('#changelog-next');
  const pageInfo = $('#changelog-page');
  
  if (!commitInfo || !commitLink || !modal) return;
  
  let currentPage = 1;
  let hasMore = true;

  // Try to fetch the latest commit for the footer
  try {
    const res = await fetch(`${WORKER_URL}?page=1`);
    if (res.ok) {
      const commits = await res.json();
      if (commits && commits.length > 0) {
        const latestSha = commits[0].sha.substring(0, 7);
        commitLink.textContent = latestSha;
        commitInfo.hidden = false;
        
        // Setup click handler
        commitLink.addEventListener('click', (e) => {
          e.preventDefault();
          openModal();
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch commits:', error);
  }
  
  async function fetchCommits(page) {
    list.innerHTML = '<div class="changelog-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading commits...</div>';
    pagination.hidden = true;
    try {
      const res = await fetch(`${WORKER_URL}?page=${page}`);
      if (!res.ok) throw new Error('API error');
      const commits = await res.json();
      
      // If we got exactly 10, assume there's potentially a next page
      hasMore = commits.length === 10;
      renderCommits(commits);
      updatePagination();
    } catch(err) {
      list.innerHTML = '<div class="changelog-error"><i class="fas fa-exclamation-triangle"></i> Failed to load commits.</div>';
      console.error(err);
    }
  }

  function renderCommits(commits) {
    list.innerHTML = '';
    
    if (!commits || commits.length === 0) {
      list.innerHTML = '<div class="changelog-empty">No commits found.</div>';
    } else {
      let currentDateGroup = '';
      let currentGroupBox = null;

      list.className = 'changelog-timeline';

      commits.forEach((commit, index) => {
        const formattedDate = formatDate(commit.date);
        
        if (formattedDate !== currentDateGroup) {
          currentDateGroup = formattedDate;
          
          const timelineItem = document.createElement('div');
          timelineItem.className = 'changelog-timeline-item';
          
          const badge = document.createElement('div');
          badge.className = 'changelog-timeline-badge';
          badge.innerHTML = '<i class="fa-solid fa-code-commit" aria-hidden="true" style="font-size: 0.8em; transform: translateY(-1px);"></i>';
          timelineItem.appendChild(badge);

          const body = document.createElement('div');
          body.className = 'changelog-timeline-body';
          
          const title = document.createElement('h4');
          title.className = 'changelog-date-title';
          title.textContent = `Commits on ${formattedDate}`;
          body.appendChild(title);

          currentGroupBox = document.createElement('div');
          currentGroupBox.className = 'changelog-group-box';
          body.appendChild(currentGroupBox);

          timelineItem.appendChild(body);
          list.appendChild(timelineItem);
        }

        const isLatest = currentPage === 1 && index === 0;

        const commitDiv = document.createElement('div');
        commitDiv.className = isLatest ? 'changelog-commit-item latest-commit' : 'changelog-commit-item';
        
        const shortSha = commit.sha.substring(0, 7);
        const messageParts = commit.message.split('\n');
        const titleText = messageParts[0]; 
        
        commitDiv.innerHTML = `
          <div class="changelog-commit-info">
            <p class="changelog-message">${titleText}</p>
          </div>
          <div class="changelog-commit-actions">
            <span class="changelog-sha-text mono">${shortSha}</span>
          </div>
        `;
        currentGroupBox.appendChild(commitDiv);
      });
    }
  }

  function updatePagination() {
    pagination.hidden = false;
    pageInfo.textContent = `Page ${currentPage}`;
    prevBtn.disabled = currentPage <= 1;
    prevBtn.style.visibility = currentPage <= 1 ? 'hidden' : 'visible';
    nextBtn.disabled = !hasMore;
    nextBtn.style.visibility = !hasMore ? 'hidden' : 'visible';
  }

  prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchCommits(currentPage);
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (hasMore) {
      currentPage++;
      fetchCommits(currentPage);
    }
  });

  function openModal() {
    currentPage = 1;
    fetchCommits(currentPage);
    
    // Show modal
    modal.hidden = false;
    document.body.style.overflow = 'hidden'; // prevent background scrolling
  }
  
  function closeModal() {
    modal.classList.add('is-closing');
    
    // Give animation time to play out
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove('is-closing');
      document.body.style.overflow = '';
    }, 200);
  }
  
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });
}
