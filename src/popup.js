import { audit } from './audit.js';

const contract = {
    id: '0x1234567890abcdef1234567890abcdef12345678',
    score: '10',
};

document.addEventListener('DOMContentLoaded', function () {
    (async () => {
        const feedItems = await fetchRSSFeed();
        updatePopup(feedItems);
    })();
    document
        .getElementById('search-button')
        .addEventListener('click', function () {
            searchContract(
                document.getElementById('search-input').value.trim()
            );
            const page1 = document.getElementById('page1');
            const page2 = document.getElementById('page2');

            page1.classList.add('move-left');
            page2.classList.remove('hidden');
            // Reset for smooth backward animation
            setTimeout(() => page1.classList.add('hidden'), 500);
        });
    document.getElementById('goBack').addEventListener('click', function () {
        const page1 = document.getElementById('page1');
        const page2 = document.getElementById('page2');

        page1.classList.remove('hidden', 'move-left');
        // Ensure that the transition occurs smoothly
        setTimeout(() => page2.classList.add('hidden'), 500);
    });
    document
        .getElementById('more-info-button')
        .addEventListener('click', function () {
            window.open('https://google.com', '_blank');
        });
});

// Define async function to fetch RSS Feed
async function fetchRSSFeed() {
    const parser = new DOMParser();
    const response = await fetch(
        'https://it.cointelegraph.com/rss/tag/blockchain'
    );
    const data = await response.text();
    const xmlDoc = parser.parseFromString(data, 'application/xml');

    const items = xmlDoc.querySelectorAll('item');
    return Array.from(items)
        .slice(0, 3)
        .map((item) => {
            const title = item.querySelector('title').textContent;
            const link = item.querySelector('link').textContent;
            let pubDateTemp = item.querySelector('pubDate').textContent;
            const pubDate = pubDateTemp.slice(0, -6).trim();

            // Extract thumbnail from <media:content>
            let thumbnail = null;
            const mediaContents = item.getElementsByTagNameNS(
                'http://search.yahoo.com/mrss/',
                'content'
            );

            for (let i = 0; i < mediaContents.length; i++) {
                const mediaContent = mediaContents[i];
                if (mediaContent.getAttribute('medium') === 'image') {
                    thumbnail = mediaContent.getAttribute('url');
                    break;
                }
            }

            // Provide a default thumbnail if none is found
            if (!thumbnail) {
                thumbnail = chrome.runtime.getURL('icons/icon.png');
            }

            return {
                title,
                link,
                pubDate,
                thumbnail,
            };
        });
}

// Function to update popup with news items
function updatePopup(feedItems) {
    const container = document.getElementById('news-feed');
    container.innerHTML = '';
    feedItems.forEach((item) => {
        const newsItem = document.createElement('div');
        const imgUrl = chrome.runtime.getURL('icons/right-arrow.svg');
        newsItem.innerHTML = `
            <a href="${item.link}" target="_blank" class="news-item">
                <div class="container" style="background-image: url('${item.thumbnail}');">
                    <div class="overlay"></div>
                    <div class="content">
                        <h4 class="title">${item.title}</h4>
                        <p class="date">${item.pubDate}</p>
                    </div>
                    <img src="${imgUrl}" alt="Right Arrow" class="icon">
                </div>
            </a>
        `;
        container.appendChild(newsItem);
    });
}

function searchContract(contractId) {
    audit(contractId)
        .then((contract) => {
            // Update the DOM elements with the contract data
            document.getElementById('contractID').textContent = contract.id;
            document.getElementById('trustScore').textContent =
                contract.trustScore + '%'; // assuming score is a percentage
            document.getElementById('riskLevel').textContent =
                contract.riskLevel;
            document.getElementById('riskDesc').textContent = contract.riskDesc;

            // Handle warnings dynamically
            const warningsList = document.getElementById('warningList');
            const warningsDiv = document.querySelector('.warnings');
            warningsList.innerHTML = ''; // Clear existing warnings

            if (contract.warnings && contract.warnings.length > 0) {
                contract.warnings.forEach((warning) => {
                    const li = document.createElement('li');
                    li.textContent = warning;
                    warningsList.appendChild(li);
                });
                warningsDiv.style.display = 'block'; // Show warnings if there are any
            } else {
                warningsDiv.style.display = 'none'; // Hide warnings div if there are no warnings
            }
        })
        .catch((error) => {
            console.error('Error fetching contract data:', error);
        });
}
