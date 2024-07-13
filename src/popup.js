import { audit } from './audit.js';

document.addEventListener('DOMContentLoaded', function () {
    (async () => {
        const feedItems = await fetchRSSFeed();
        updatePopup(feedItems);
    })();
    var homePage = document.getElementById('page1');
    var searchPage = document.getElementById('page2');
    document
        .getElementById('search-button')
        .addEventListener('click', async function (event) {
            // Corrected to include 'event' as a parameter
            const input = document.getElementById('search-input');
            const errorMessage = document.getElementById('error-message');

            const searchType = document.querySelector(
                'input[name="searchType"]:checked'
            )?.value;

            if (searchType === 'program') {
                input.setAttribute('pattern', '^[A-Za-z0-9]{40,45}$');
                input.title = 'Insert a valid Program ID.';
            } else if (searchType === 'transaction') {
                input.setAttribute('pattern', '^[A-Za-z0-9]{88}$');
                input.title = 'Insert a valid Transaction ID.';
            }

            // Validate input
            if (!input.checkValidity()) {
                errorMessage.textContent = input.title; // Use the title as the error message
                errorMessage.style.display = 'block';
                event.preventDefault(); // Prevent form submission if invalid
                return false;
            } else {
                errorMessage.style.display = 'none'; // Hide error message if input is valid
            }

            // Disable the button to prevent multiple clicks during processing
            this.disabled = true;

            // Call the async function and wait for it to complete
            await setSearchResult(searchType, input.value.trim());

            homePage.classList.remove('active');
            searchPage.style.display = '';

            setTimeout(() => {
                searchPage.classList.add('active');
                homePage.style.display = 'none';
            }, 500);
            // Re-enable the button after the process is complete
            this.disabled = false;
        });
    document.getElementById('goBack').addEventListener('click', function () {
        searchPage.classList.remove('active');
        homePage.style.display = '';
        setTimeout(() => {
            // Set display none after transition ends to hide the page
            searchPage.style.display = 'none';
            homePage.classList.add('active');
        }, 500);
    });
    document
        .getElementById('more-info-button')
        .addEventListener('click', function () {
            window.open('http://rob3.live/', '_blank');
        });
});

// Define async function to fetch RSS Feed
async function fetchRSSFeed() {
    const parser = new DOMParser();
    const response = await fetch('https://bitcoinist.com/feed/');
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

async function setSearchResult(searchType, contractId) {
    try {
        const contract = await audit(searchType, contractId); // Ensure `audit` returns a promise

        // Update the DOM elements with the contract data
        updateId(contract.id);
        updateTrustScore(contract.trustScore);
        document.getElementById('riskLevel').textContent = contract.riskLevel;
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
    } catch (error) {
        console.error('Error fetching contract data:', error);
    }
}

function updateId(contractId) {
    const displayElement = document.getElementById('contractID');
    if (contractId.length > 16) {
        // Display first 8 and last 8 characters
        displayElement.textContent = `${contractId.slice(
            0,
            8
        )}...${contractId.slice(-8)}`;
    } else {
        // If the ID is not long enough, just display it as is
        displayElement.textContent = contractId;
    }
}

function updateTrustScore(trustScore) {
    const scoreElement = document.getElementById('trustScore');
    scoreElement.textContent = trustScore + '%';

    // Calculate color based on trust score
    const red = 255 - Math.round(trustScore * 2.55); // Decreases with higher score
    const green = Math.round(trustScore * 2.55); // Increases with higher score
    const blue = 0; // Constant, not used in gradient

    // Set the background color of the circle
    scoreElement.style.borderColor = `rgb(${red}, ${green}, ${blue})`;
}
