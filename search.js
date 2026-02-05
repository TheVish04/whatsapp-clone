// Encapsulated search / find-in-chat feature extracted from main script.
// This keeps all search-related DOM listeners and state in one place.

export function initSearch({
    searchBtn,
    searchBarContainer,
    searchInput,
    searchBackBtn,
    searchClearBtn,
    searchControls,
    searchCounter,
    searchUpBtn,
    searchDownBtn,
    chatContainer
}) {
    if (
        !searchBtn ||
        !searchBarContainer ||
        !searchInput ||
        !searchBackBtn ||
        !searchClearBtn ||
        !searchControls ||
        !searchCounter ||
        !searchUpBtn ||
        !searchDownBtn ||
        !chatContainer
    ) {
        // In case some elements are missing (e.g. different layout), bail out safely.
        return;
    }

    let currentSearchMatches = [];
    let currentMatchIndex = -1;

    const closeSearchBar = () => {
        if (!searchBarContainer.classList.contains('hidden')) {
            searchBarContainer.classList.add('hidden');
            searchInput.value = '';
            performSearch('');
        }
    };

    const performSearch = (query) => {
        const messages = chatContainer.querySelectorAll('.message');
        const lowerQuery = query.toLowerCase();

        currentSearchMatches = [];
        currentMatchIndex = -1;

        messages.forEach(msg => {
            // Always ensure message is visible (no filtering, only highlighting)
            msg.style.removeProperty('display');

            const textNode = msg.querySelector('.msg-text');
            const docNameNode = msg.querySelector('.doc-name');

            let isMatch = false;

            if (textNode) {
                // Restore original text first
                if (!textNode.hasAttribute('data-original')) {
                    textNode.setAttribute('data-original', textNode.textContent);
                }
                const originalText = textNode.getAttribute('data-original');

                if (query === '') {
                    textNode.textContent = originalText;
                } else if (originalText.toLowerCase().includes(lowerQuery)) {
                    isMatch = true;
                    const regex = new RegExp(`(${query})`, 'gi');
                    const highlighted = originalText.replace(
                        regex,
                        '<span class="highlight-text">$1</span>'
                    );
                    textNode.innerHTML = highlighted;
                } else {
                    textNode.textContent = originalText;
                }
            } else if (docNameNode) {
                if (docNameNode.textContent.toLowerCase().includes(lowerQuery) && query !== '') {
                    isMatch = true;
                }
            }

            if (isMatch) {
                currentSearchMatches.push(msg);
            }
        });

        if (query !== '' && currentSearchMatches.length > 0) {
            searchControls.classList.remove('hidden');
            // Start at most recent match (bottom)
            currentMatchIndex = currentSearchMatches.length - 1;
            updateSearchCounter();
            scrollToMatch(currentMatchIndex);
        } else {
            searchControls.classList.add('hidden');
        }
    };

    const updateSearchCounter = () => {
        searchCounter.textContent = `${currentMatchIndex + 1} of ${currentSearchMatches.length}`;
    };

    const scrollToMatch = (index) => {
        const msg = currentSearchMatches[index];
        if (msg) {
            msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            msg.classList.add('highlight-message');
            setTimeout(() => msg.classList.remove('highlight-message'), 1000);
        }
    };

    const navigateSearch = (direction) => {
        if (currentSearchMatches.length === 0) return;

        currentMatchIndex += direction;

        if (currentMatchIndex < 0) currentMatchIndex = currentSearchMatches.length - 1;
        if (currentMatchIndex >= currentSearchMatches.length) currentMatchIndex = 0;

        updateSearchCounter();
        scrollToMatch(currentMatchIndex);
    };

    // Event wiring
    searchBtn.addEventListener('click', () => {
        searchBarContainer.classList.remove('hidden');
        searchInput.focus();
    });

    searchBackBtn.addEventListener('click', closeSearchBar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSearchBar();
    });

    document.addEventListener('click', (e) => {
        if (searchBarContainer.classList.contains('hidden')) return;
        if (!searchBarContainer.contains(e.target) && !searchBtn.contains(e.target)) {
            closeSearchBar();
        }
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        performSearch('');
    });

    searchUpBtn.addEventListener('click', () => navigateSearch(-1));
    searchDownBtn.addEventListener('click', () => navigateSearch(1));

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.length > 0) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
        }
        performSearch(query);
    });
}

