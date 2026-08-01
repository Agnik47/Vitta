# Webcmd Available Commands

_Auto-generated from manifest.json. This is the reference document for the AI to understand available commands._

## amazon

### Read Commands

#### `bestsellers`
Amazon Best Sellers pages for category candidate discovery

Arguments:
  --input <str> (optional) — Ranking URL or supported Amazon path. Omit to use the list root.
  --limit <int> (optional) — Maximum number of ranked items to return (default 100)

#### `discussion`
Amazon review summary and sample customer discussion from product review pages

Arguments:
  --input <str> (required) — ASIN or product URL, for example B0FJS72893
  --limit <int> (optional) — Maximum number of review samples to return (default 10)

#### `movers-shakers`
Amazon Movers & Shakers pages for short-term growth signals

Arguments:
  --input <str> (optional) — Ranking URL or supported Amazon path. Omit to use the list root.
  --limit <int> (optional) — Maximum number of ranked items to return (default 100)

#### `new-releases`
Amazon New Releases pages for early momentum discovery

Arguments:
  --input <str> (optional) — Ranking URL or supported Amazon path. Omit to use the list root.
  --limit <int> (optional) — Maximum number of ranked items to return (default 100)

#### `offer`
Amazon seller, buy box, and fulfillment facts from the product page

Arguments:
  --input <str> (required) — ASIN or product URL, for example B0FJS72893

#### `product`
Amazon product page facts for candidate validation

Arguments:
  --input <str> (required) — ASIN or product URL, for example B0FJS72893

#### `search`
Amazon search results for product discovery and coarse filtering

Arguments:
  --query <str> (required) — Search query, for example "desk shelf organizer"
  --limit <int> (optional) — Maximum number of results to return (default 20)

#### `whoami`
Show the current logged-in amazon account

### Write Commands ⚠️

#### `login`
Open amazon login


## amazon-in

### Read Commands

#### `checkout-status`
Read the current Amazon.in checkout or payment state without clicking

#### `product`
Fetch the current Amazon.in price and selected product variant

Arguments:
  --input <str> (required) — Amazon.in product URL or ASIN

#### `search`
Search Amazon.in products with inclusive INR price bounds and images

Arguments:
  --query <str> (required) — Product search query
  --min-price <number> (optional) — Inclusive minimum price in rupees
  --max-price <number> (optional) — Inclusive maximum price in rupees
  --limit <int> (optional) — Maximum results (1-50)

#### `whoami`
Show the current logged-in amazon-in account

#### `wishlist`
Fetch current prices for products in the default Amazon.in wishlist

Arguments:
  --filter <str> (optional) [unpurchased|all] — Wishlist items to include

### Write Commands ⚠️

#### `checkout`
Prepare a guarded Amazon.in checkout with browser-only payment handoff

Arguments:
  --input <str> (required) — Amazon.in product URL or ASIN
  --quantity <int> (optional) — Quantity (1-10)
  --size <str> (optional) — Exact visible size label
  --colour <str> (optional) — Exact visible colour label
  --payment <str> (required) [upi|saved-card|new-card|cod] — Payment method; secrets remain browser-only
  --card-last4 <str> (optional) — Saved-card selector: exactly four digits
  --place-order <boolean> (optional) — Submit the final Amazon action once

#### `login`
Open amazon-in login


## antigravity

### Read Commands

#### `cookies`
List cookies on the Antigravity renderer (JS-visible via document.cookie).

#### `copy-code`
Return the text of a code block in the current conversation. Default: last code block; pass --index N (1-based from top) to pick a specific one.

Arguments:
  --index <int> (optional) — 1-based index of code block (default: last)

#### `display-options`
Open the Display Options menu and list its items.

#### `dump`
Dump the DOM to help AI understand the UI

#### `extract-code`
Extract multi-line code blocks from the current Antigravity conversation

#### `history`
List visible Antigravity conversations from the sidebar

Arguments:
  --limit <int> (optional) — Max conversations to return

#### `idb-list`
List IndexedDB databases on the Antigravity renderer.

#### `new`
Start a new conversation / clear context in Antigravity

#### `read`
Read the latest chat messages from Antigravity AI

Arguments:
  --last <str> (optional) — Number of recent messages to read (not fully implemented due to generic structure, currently returns full history text or latest chunk)

#### `recent-paths`
Show Antigravity's recently-opened folders/files (history.recentlyOpenedPathsList).

Arguments:
  --limit <int> (optional) — Max rows to return

#### `settings-read`
Read Antigravity's user settings.json (theme, proxy, agCockpit, tfa.system.autoAccept, etc.).

#### `state-get`
Read one value from Antigravity's state.vscdb. Pass --workspace <id> for per-workspace.

Arguments:
  --key <str> (required) — Storage key name
  --workspace <str> (optional) — Workspace id (from workspaces-list) to query per-workspace DB
  --max-bytes <int> (optional) — Truncate value to this many chars

#### `state-keys`
List keys in Antigravity's globalStorage state.vscdb (VSCode-style). Pass --workspace <id> to query a per-workspace DB. Works while Antigravity is closed.

Arguments:
  --filter <str> (optional) — Case-insensitive substring filter over keys
  --workspace <str> (optional) — Workspace id (from workspaces-list) to query per-workspace DB
  --limit <int> (optional) — Max rows to return

#### `status`
Check Antigravity CDP connection and get current page state

#### `storage-get`
Read a single localStorage / sessionStorage value on the Antigravity renderer.

Arguments:
  --key <str> (required) — Storage key name
  --storage <str> (optional) — "local" or "session"
  --max-bytes <int> (optional) — Truncate value to this many chars

#### `storage-keys`
List localStorage / sessionStorage keys on the Antigravity renderer (CDP).

Arguments:
  --storage <str> (optional) — "local" or "session"
  --filter <str> (optional) — Case-insensitive substring filter
  --limit <int> (optional) — Max rows to return

#### `watch`
Stream new chat messages from Antigravity in real-time

Arguments:
  --timeout <int> (optional) — Max seconds to keep watching (default: 86400 — 24h)

#### `workspaces-list`
List Antigravity workspaceStorage entries (each represents a previously-opened folder).

Arguments:
  --limit <int> (optional) — Max rows to return

### Write Commands ⚠️

#### `add-context`
Click the Add context button in the composer (opens file/URL picker for context attachment).

#### `copy-message`
Return the text of the last assistant message (best-effort: walks up from the last visible Copy button).

Arguments:
  --click-button <boolean> (optional) — Also click the in-UI Copy button

#### `delete`
Delete an Antigravity conversation by ID. Antigravity asks for confirmation; we click through it. Require --yes to actually delete.

Arguments:
  --id <string> (required) — Conversation UUID (the part after "convo-pill-" in the sidebar testid)
  --yes <boolean> (optional) — Actually delete (default: dry-run preview)

#### `mark-read`
Mark an unread Antigravity conversation as read. Fails if the row is already read or the postcondition cannot be verified.

Arguments:
  --id <string> (required) — Conversation UUID (the part after "convo-pill-" in the sidebar testid)

#### `model`
Read or switch the active model in Antigravity. Without arguments, reports the current model. With <name> (substring, case-insensitive), switches.

Arguments:
  --name <str> (optional) — Substring (case-insensitive) of target model name. Omit to read current.
  --list <boolean> (optional) — List models in the picker (does not switch)

#### `nav`
Click Go Back or Go Forward (Antigravity in-app history).

Arguments:
  --direction <str> (required) — back or forward

#### `react`
Click "Good response" or "Bad response" on the LAST assistant message.

Arguments:
  --kind <str> (required) — good or bad

#### `rename`
Rename an Antigravity conversation by ID (NOT YET IMPLEMENTED — see source comment).

Arguments:
  --id <string> (required) — Conversation UUID (the part after "convo-pill-" in the sidebar testid)
  --title <string> (required) — New title

#### `revert`
Click the revert button (per-message revert for agent changes). Requires --yes (this modifies your workspace).

Arguments:
  --yes <boolean> (optional) — Actually revert (default: dry-run)

#### `send`
Send a message to Antigravity AI via the internal Lexical editor

Arguments:
  --message <str> (required) — The message text to send

#### `settings`
Click the Antigravity settings button (matched by data-testid="settings-button").

#### `sidebar-toggle`
Click Toggle Sidebar (collapses/expands the Antigravity sidebar).

#### `toggle-aux`
Toggle the Auxiliary Pane (Antigravity's secondary panel for code/preview).


## apple-podcasts

### Read Commands

#### `episodes`
List recent episodes of an Apple Podcast (use ID from search)

Arguments:
  --id <str> (required) — Podcast ID (collectionId from search output)
  --limit <int> (optional) — Max episodes to show

#### `search`
Search Apple Podcasts

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Max results

#### `top`
Top podcasts chart on Apple Podcasts

Arguments:
  --limit <int> (optional) — Number of podcasts (max 100)
  --country <str> (optional) — Country code (e.g. us, cn, gb, jp)


## archive

### Read Commands

#### `item`
Fetch metadata for a single Internet Archive item by identifier.

Arguments:
  --identifier <str> (required) — Archive item identifier (e.g. "open-syllabus", "FinalFantasy2_356").

#### `search`
Search Internet Archive items across books, movies, audio, software, and web.

Arguments:
  --query <str> (required) — Full-text query (matches title, description, creator, subject).
  --mediatype <string> (optional) — Restrict to mediatype: texts, movies, audio, software, image, web, data, collection
  --sort <string> (optional) — Sort key: downloads, date, addeddate, week, title
  --limit <int> (optional) — Max items (max 100; one API page).

#### `snapshots`
List Wayback Machine snapshots over time for a URL via the CDX API.

Arguments:
  --url <str> (required) — URL to look up (with or without scheme).
  --from <string> (optional) — Earliest year/timestamp (YYYY[MM[DD[hh[mm[ss]]]]])
  --to <string> (optional) — Latest year/timestamp (YYYY[MM[DD[hh[mm[ss]]]]])
  --limit <int> (optional) — Max snapshots to return (max 1000).

#### `wayback`
Look up the closest Wayback Machine snapshot for a URL.

Arguments:
  --url <str> (required) — URL to look up (with or without scheme).
  --timestamp <string> (optional) — Target timestamp (YYYY[MM[DD[hh[mm[ss]]]]] or ISO date). Defaults to most recent snapshot.


## arxiv

### Read Commands

#### `author`
List arXiv papers by a given author (newest first)

Arguments:
  --author <str> (required) — Author name (e.g. "Yoshua Bengio" or "Y Bengio")
  --limit <int> (optional) — Max papers to return (max 50)

#### `paper`
Get arXiv paper details by ID

Arguments:
  --id <str> (required) — arXiv paper ID (e.g. 1706.03762)

#### `recent`
List recent arXiv submissions in a category

Arguments:
  --category <str> (required) — arXiv category (e.g. cs.CL, cs.LG, math.PR, q-bio.NC)
  --limit <int> (optional) — Max results (max 50)

#### `search`
Search arXiv papers

Arguments:
  --query <str> (required) — Search keyword (e.g. "attention is all you need")
  --limit <int> (optional) — Max results (max 25)


## band

### Read Commands

#### `bands`
List all Bands you belong to

#### `mentions`
Show Band notifications where you are @mentioned

Arguments:
  --filter <str> (optional) [mentioned|all|post|comment] — Filter: mentioned (default) | all | post | comment
  --limit <int> (optional) — Max results
  --unread <bool> (optional) — Show only unread notifications

#### `post`
Export full content of a post including comments

Arguments:
  --band_no <int> (required) — Band number
  --post_no <int> (required) — Post number
  --output <str> (optional) — Directory to save attached photos
  --comments <bool> (optional) — Include comments (default: true)

#### `posts`
List posts from a Band

Arguments:
  --band_no <int> (required) — Band number (get it from: band bands)
  --limit <int> (optional) — Max results

#### `whoami`
Show the current logged-in band account

### Write Commands ⚠️

#### `login`
Open band login


## barchart

### Read Commands

#### `flow`
Barchart unusual options activity / options flow

Arguments:
  --type <str> (optional) [all|call|put] — Filter: all, call, or put
  --limit <int> (optional) — Number of results

#### `greeks`
Barchart options greeks overview (IV, delta, gamma, theta, vega)

Arguments:
  --symbol <str> (required) — Stock ticker (e.g. AAPL)
  --expiration <str> (optional) — Expiration date (YYYY-MM-DD). Defaults to the nearest available expiration.
  --limit <int> (optional) — Number of near-the-money strikes per type (1-100)

#### `options`
Barchart options chain with greeks, IV, volume, and open interest

Arguments:
  --symbol <str> (required) — Stock ticker (e.g. AAPL)
  --type <str> (optional) [Call|Put] — Option type: Call or Put
  --limit <int> (optional) — Max number of strikes to return

#### `quote`
Barchart stock quote with price, volume, and key metrics

Arguments:
  --symbol <str> (required) — Stock ticker (e.g. AAPL, MSFT, TSLA)


## bbc

### Read Commands

#### `news`
BBC News headlines (RSS)

Arguments:
  --limit <int> (optional) — Number of headlines (max 50)

#### `topic`
BBC News headlines for a specific section (RSS feed)

Arguments:
  --topic <str> (required) — Section name (world / business / politics / health / education / science_and_environment / technology / entertainment_and_arts)
  --limit <int> (optional) — Max headlines (1-50)


## bigbasket

### Read Commands

#### `cart`
Read BigBasket cart line items

#### `category`
Read BigBasket category product cards

Arguments:
  --category <str> (required) — Category URL or slug
  --limit <int> (optional) — Maximum products to return (max 50)

#### `location`
Show the selected BigBasket delivery location

#### `product`
Read BigBasket product details

Arguments:
  --product <str> (required) — Product ID or URL

#### `search`
Search BigBasket products

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Maximum products to return (max 50)

### Write Commands ⚠️

#### `add-to-cart`
Add a BigBasket product to cart

Arguments:
  --product <str> (required) — Product ID or URL
  --quantity <int> (optional) — Quantity to add (max 20)

#### `checkout`
Open BigBasket checkout review without placing an order


## binance

### Read Commands

#### `asks`
Order book ask prices for a trading pair

Arguments:
  --symbol <str> (required) — Trading pair symbol (e.g. BTCUSDT, ETHUSDT)
  --limit <int> (optional) — Number of price levels (5, 10, 20, 50, 100)

#### `depth`
Order book bid and ask prices for a trading pair

Arguments:
  --symbol <str> (required) — Trading pair symbol (e.g. BTCUSDT, ETHUSDT)
  --limit <int> (optional) — Number of price levels (5, 10, 20, 50, 100)

#### `gainers`
Top gaining trading pairs by 24h price change

Arguments:
  --limit <int> (optional) — Number of trading pairs

#### `klines`
Candlestick/kline data for a trading pair

Arguments:
  --symbol <str> (required) — Trading pair symbol (e.g. BTCUSDT, ETHUSDT)
  --interval <str> (optional) — Kline interval (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
  --limit <int> (optional) — Number of klines (max 1000)

#### `losers`
Top losing trading pairs by 24h price change

Arguments:
  --limit <int> (optional) — Number of trading pairs

#### `pairs`
List active trading pairs on Binance

Arguments:
  --limit <int> (optional) — Number of trading pairs

#### `price`
Quick price check for a trading pair

Arguments:
  --symbol <str> (required) — Trading pair symbol (e.g. BTCUSDT, ETHUSDT)

#### `prices`
Latest prices for all trading pairs

Arguments:
  --limit <int> (optional) — Number of prices

#### `ticker`
24h ticker statistics for top trading pairs by volume

Arguments:
  --limit <int> (optional) — Number of tickers

#### `top`
Top trading pairs by 24h volume on Binance

Arguments:
  --limit <int> (optional) — Number of trading pairs

#### `trades`
Recent trades for a trading pair

Arguments:
  --symbol <str> (required) — Trading pair symbol (e.g. BTCUSDT, ETHUSDT)
  --limit <int> (optional) — Number of trades (max 1000)


## blinkit

### Read Commands

#### `cart`
Show the current Blinkit cart

#### `checkout`
Review Blinkit checkout totals and blockers without placing an order

#### `location`
Show the selected Blinkit delivery location

#### `product`
Read Blinkit product details for a delivery location

Arguments:
  --productId <str> (required) — Blinkit product id
  --lat <str> (optional) — Delivery latitude (defaults to current Blinkit browser location)
  --lon <str> (optional) — Delivery longitude (defaults to current Blinkit browser location)

#### `search`
Search Blinkit products for a delivery location

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Max results (max 48)
  --lat <str> (optional) — Delivery latitude (defaults to current Blinkit browser location)
  --lon <str> (optional) — Delivery longitude (defaults to current Blinkit browser location)

#### `whoami`
Show the current logged-in blinkit account

### Write Commands ⚠️

#### `add-to-cart`
Add a Blinkit product to cart

Arguments:
  --productId <str> (required) — Blinkit product id
  --quantity <int> (optional) — Quantity to add (default 1, max 12)
  --lat <str> (optional) — Delivery latitude (defaults to current Blinkit browser location)
  --lon <str> (optional) — Delivery longitude (defaults to current Blinkit browser location)

#### `clear-cart`
Remove every line from the current Blinkit cart

#### `login`
Open blinkit login

#### `place-order`
Advance the Blinkit checkout and submit the final order/payment action. Requires --confirm.

Arguments:
  --confirm <bool> (optional) — Required acknowledgement that this may place/pay for a real order
  --advance-only <bool> (optional) — Walk the checkout up to the payment step and report it, without ever clicking a paying button

#### `set-cart-quantity`
Set a Blinkit cart line to an exact quantity (0 removes it)

Arguments:
  --productId <string> (required) — Blinkit product id
  --quantity <int> (required) — Exact quantity to end up with (0-12; 0 removes the item)


## bloomberg

### Read Commands

#### `businessweek`
Bloomberg Businessweek top stories

Arguments:
  --limit <int> (optional) — Number of stories to return (max 20)

#### `crypto`
Bloomberg Crypto top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `economics`
Bloomberg Economics top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `feeds`
List the Bloomberg RSS feed aliases used by the adapter

#### `green`
Bloomberg Green (climate & energy) top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `industries`
Bloomberg Industries top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `main`
Bloomberg homepage top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `markets`
Bloomberg Markets top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `news`
Read a Bloomberg story/article page and return title, full content, and media links

Arguments:
  --link <str> (required) — Bloomberg story/article URL or relative Bloomberg path

#### `opinions`
Bloomberg Opinion top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `politics`
Bloomberg Politics top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `pursuits`
Bloomberg Pursuits (lifestyle) top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)

#### `tech`
Bloomberg Tech top stories (RSS)

Arguments:
  --limit <int> (optional) — Number of feed items to return (max 20)


## bluesky

### Read Commands

#### `feeds`
Popular Bluesky feed generators

Arguments:
  --limit <int> (optional) — Number of feeds

#### `followers`
List followers of a Bluesky user

Arguments:
  --handle <str> (required) — Bluesky handle
  --limit <int> (optional) — Number of followers

#### `following`
List accounts a Bluesky user is following

Arguments:
  --handle <str> (required) — Bluesky handle
  --limit <int> (optional) — Number of accounts

#### `profile`
Get Bluesky user profile info

Arguments:
  --handle <str> (required) — Bluesky handle (e.g. bsky.app, jay.bsky.team)

#### `search`
Search Bluesky users

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results

#### `starter-packs`
Get starter packs created by a Bluesky user

Arguments:
  --handle <str> (required) — Bluesky handle
  --limit <int> (optional) — Number of starter packs

#### `thread`
Get a Bluesky post thread with replies

Arguments:
  --uri <str> (required) — Post AT URI (at://did:.../app.bsky.feed.post/...) or bsky.app URL
  --limit <int> (optional) — Number of replies

#### `trending`
Trending topics on Bluesky

Arguments:
  --limit <int> (optional) — Number of topics

#### `user`
Get recent posts from a Bluesky user

Arguments:
  --handle <str> (required) — Bluesky handle (e.g. bsky.app)
  --limit <int> (optional) — Number of posts


## booking

### Read Commands

#### `search`
Search Booking.com hotels by destination and dates (server-rendered card scrape).

Arguments:
  --destination <str> (required) — Destination keyword (city, district, or hotel name)
  --checkin <str> (required) — Check-in date YYYY-MM-DD
  --checkout <str> (required) — Check-out date YYYY-MM-DD
  --adults <int> (optional) — Number of adults (1-30)
  --rooms <int> (optional) — Number of rooms (1-30)
  --children <int> (optional) — Number of children (0-10)
  --currency <str> (optional) — Force result currency (e.g. USD, JPY, CNY)
  --lang <str> (optional) — Force result language (e.g. en-us, zh-cn, ja)
  --limit <int> (optional) — Max rows to return (1-100; Booking pages 25 per request)
  --offset <int> (optional) — Result offset for pagination (multiple of 25)


## brave

### Read Commands

#### `search`
Search Brave Search

Arguments:
  --keyword <str> (required) — Search query
  --limit <int> (optional) — Number of results per page (max 18)
  --offset <int> (optional) — Page offset (0, 1, 2...). Brave returns ~18 results per page


## chatgpt

### Read Commands

#### `deep-research-result`
Read a ChatGPT Deep Research report or progress from the conversation payload

Arguments:
  --id <str> (required) — Conversation ID or full /c/<id> URL
  --wait <boolean> (optional) — Wait until Deep Research completes or becomes extractable
  --timeout <int> (optional) — Max seconds to wait when --wait is true
  --stable <int> (optional) — Seconds the report text must remain unchanged when --wait is true

#### `detail`
Open a ChatGPT web conversation by ID and read its messages

Arguments:
  --id <str> (required) — Conversation ID or full /c/<id> URL
  --markdown <boolean> (optional) — Emit assistant replies as markdown
  --wait <boolean> (optional) — Wait until the conversation stops generating and stabilizes
  --timeout <int> (optional) — Max seconds to wait when --wait is true
  --stable <int> (optional) — Seconds the final messages must remain unchanged when --wait is true

#### `history`
List visible ChatGPT web conversation history from the sidebar

Arguments:
  --limit <int> (optional) — Max conversations to show

#### `new`
Start a new ChatGPT web conversation

Arguments:
  --project <str> (optional) — Start a new chat inside a ChatGPT project ID or /g/g-p-<id> URL

#### `project-list`
List visible ChatGPT projects from the sidebar

Arguments:
  --limit <int> (optional) — Max projects to show

#### `read`
Read messages in the current ChatGPT web conversation

Arguments:
  --markdown <boolean> (optional) — Emit assistant replies as markdown

#### `status`
Check ChatGPT web page availability and login state

#### `whoami`
Show the current logged-in chatgpt account

### Write Commands ⚠️

#### `ask`
Send a prompt to ChatGPT web and wait for the response

Arguments:
  --prompt <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds to wait for response
  --new <boolean> (optional) — Start a new chat before sending
  --conversation <str> (optional) — Continue an existing ChatGPT conversation ID or /c/<id> URL
  --project <str> (optional) — Start a new chat inside a ChatGPT project ID or /g/g-p-<id> URL
  --wait <boolean> (optional) — Wait for the assistant response after sending
  --deep-research <boolean> (optional) — Enable ChatGPT Deep Research (Deep Research)
  --web-search <boolean> (optional) — Enable ChatGPT Web Search (Web Search)

#### `image`
Generate images with ChatGPT web and save them locally

Arguments:
  --prompt <str> (required) — Image prompt to send to ChatGPT
  --image <str> (optional) — Local image path to attach before prompting; comma-separated paths are supported
  --project <str> (optional) — Start image generation inside a ChatGPT project ID or /g/g-p-<id> URL
  --op <str> (optional) — Output directory (default: ~/Pictures/chatgpt)
  --sd <boolean> (optional) — Skip download shorthand; only show ChatGPT link
  --timeout <int> (optional) — Max seconds for the overall command (default: 240)

#### `login`
Open chatgpt login

#### `model`
Switch ChatGPT web model or intelligence level (GPT-5.6 Pro, fast, balanced, advanced, very-high, pro)

Arguments:
  --model <str> (required) [fast|speed|instant|balanced|balance|medium|advanced|high|thinking|very-high|ultra|xhigh|x-high|extra-high|very high|gpt-5.6-pro|gpt-5-6-pro|gpt-5.6-sol-pro|gpt-5-6-sol-pro|gpt-5.6|gpt-5-6|5.6-pro|5.6|pro|professional] — ChatGPT model or intelligence level to switch to
  --project <str> (optional) — Open a ChatGPT project ID or /g/g-p-<id> URL before switching intelligence level

#### `project-file-add`
Upload files to a ChatGPT project as project knowledge (not just conversation attachments)

Arguments:
  --file <str> (required) — Local file path(s) to upload; comma-separated paths are supported
  --id <str> (required) — Project ID or /g/g-p-<id> URL

#### `send`
Send a prompt to ChatGPT web without waiting for the response

Arguments:
  --prompt <str> (required) — Prompt to send
  --new <boolean> (optional) — Start a new chat before sending
  --conversation <str> (optional) — Continue an existing ChatGPT conversation ID or /c/<id> URL
  --project <str> (optional) — Start a new chat inside a ChatGPT project ID or /g/g-p-<id> URL


## chatgpt-app

### Read Commands

#### `model`
Switch ChatGPT Desktop model/mode (auto, instant, thinking, 5.2-instant, 5.2-thinking)

Arguments:
  --model <str> (required) [auto|instant|thinking|5.2-instant|5.2-thinking] — Model to switch to

#### `read`
Read the last visible message from the focused ChatGPT Desktop window

#### `status`
Check if ChatGPT Desktop App is running natively on macOS

### Write Commands ⚠️

#### `ask`
Send a prompt and wait for the AI response (send + wait + read)

Arguments:
  --text <str> (required) — Prompt to send
  --model <str> (optional) [auto|instant|thinking|5.2-instant|5.2-thinking] — Model/mode to use: auto, instant, thinking, 5.2-instant, 5.2-thinking
  --timeout <int> (optional) — Max seconds to wait for response (default: 30)
  --image <str> (optional) — Path to local image to attach (optional)

#### `new`
Open a new chat in ChatGPT Desktop App

Arguments:
  --temp <boolean> (optional) — Open a temporary chat with privacy protection

#### `send`
Send a message to the active ChatGPT Desktop App window

Arguments:
  --text <str> (required) — Message to send
  --model <str> (optional) [auto|instant|thinking|5.2-instant|5.2-thinking] — Model/mode to use: auto, instant, thinking, 5.2-instant, 5.2-thinking


## chatwise

### Read Commands

#### `export`
Export the current ChatWise conversation to a Markdown file

Arguments:
  --output <str> (optional) — Output file (default: /tmp/chatwise-export.md)

#### `history`
List conversation history in ChatWise sidebar

#### `model`
Get or switch the active AI model in ChatWise

Arguments:
  --model-name <str> (optional) — Model to switch to (e.g. gpt-4, claude-3)

#### `read`
Read the current ChatWise conversation history

#### `screenshot`
Capture a snapshot of the current ChatWise window (DOM + Accessibility tree)

Arguments:
  --output <str> (optional) — Output file path (default: /tmp/chatwise-snapshot.txt)

#### `status`
Check active CDP connection to ChatWise Desktop

### Write Commands ⚠️

#### `ask`
Send a prompt and wait for the AI response (send + wait + read)

Arguments:
  --text <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds to wait (default: 30)

#### `new`
Start a new ChatWise conversation session

#### `send`
Send a message to the active ChatWise conversation

Arguments:
  --text <str> (required) — Message to send


## chess

### Read Commands

#### `analyze`
Open a Chess.com game in the browser analysis board

Arguments:
  --game-url <string> (required) — Full game URL, e.g. https://www.chess.com/game/live/168842570216

#### `game`
Chess.com single-game detail (white, black, result, ECO, time control) by full game URL

Arguments:
  --game-url <string> (required) — Full game URL, e.g. https://www.chess.com/game/live/168842570216

#### `games`
Chess.com recent games for a player, newest first

Arguments:
  --username <string> (required) — Chess.com username
  --limit <int> (optional) — Number of recent games (1-100)

#### `stats`
Chess.com player ratings + win/loss record across game kinds

Arguments:
  --username <string> (required) — Chess.com username (case-insensitive)


## claude

### Read Commands

#### `detail`
Open a Claude conversation by ID and read its messages

Arguments:
  --id <str> (required) — Conversation ID (UUID from /chat/<id>)

#### `history`
List conversation history from Claude /recents

Arguments:
  --limit <int> (optional) — Max conversations to show

#### `new`
Start a new conversation in Claude

#### `read`
Read the current Claude conversation

#### `status`
Check Claude page availability and login state

#### `whoami`
Show the current logged-in claude account

### Write Commands ⚠️

#### `ask`
Send a prompt to Claude and get the response

Arguments:
  --prompt <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds to wait for response
  --new <boolean> (optional) — Start a new chat before sending
  --model <str> (optional) [sonnet|opus|haiku] — Model to use: sonnet, opus, or haiku
  --think <boolean> (optional) — Enable Adaptive thinking
  --file <str> (optional) — Attach a file (image, PDF, text) with the prompt

#### `login`
Open claude login

#### `send`
Send a prompt to Claude without waiting for the response

Arguments:
  --prompt <str> (required) — Prompt to send
  --new <boolean> (optional) — Start a new chat before sending


## codex

### Read Commands

#### `dump`
Dump the DOM and Accessibility tree of codex for reverse-engineering

#### `export`
Export the current Codex conversation to a Markdown file

Arguments:
  --output <str> (optional) — Output file (default: /tmp/codex-export.md)

#### `extract-diff`
Extract visual code review diff patches from Codex

#### `history`
List visible Codex conversation threads grouped by project

Arguments:
  --project <str> (optional) — Filter by project label or path
  --limit <str> (optional) — Max conversations per project

#### `projects`
List Codex projects and visible conversations from the sidebar

Arguments:
  --project <str> (optional) — Filter by project label or path
  --limit <str> (optional) — Max conversations per project

#### `read`
Read the contents of the current or selected Codex conversation thread

Arguments:
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `screenshot`
Capture a snapshot of the current Codex window (DOM + Accessibility tree)

Arguments:
  --output <str> (optional) — Output file path (default: /tmp/codex-snapshot.txt)

#### `status`
Check active CDP connection to OpenAI Codex App

### Write Commands ⚠️

#### `archive`
Archive (Codex's term for delete) the selected conversation via the Chat actions header menu. No confirmation in UI — pass --yes to actually archive.

Arguments:
  --yes <boolean> (optional) — Actually archive (default: dry-run preview)
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `ask`
Send a prompt to the current or selected Codex conversation and wait for the AI response

Arguments:
  --text <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds to wait for response (default: 60)
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `model`
Read, list, or switch the active model / reasoning level in Codex Desktop. The composer toolbar button toggles a menu that mixes model variants (GPT-5.5, Speed) with reasoning levels (Low/Medium/High/Extra High).

Arguments:
  --name <str> (optional) — Substring (case-insensitive) of a model / reasoning level to switch to. Omit to read current.
  --list <boolean> (optional) — List all menu options (does not switch)

#### `new`
Start a new Codex conversation session

#### `pin`
Pin the selected Codex conversation via the Chat actions header menu.

Arguments:
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `rename`
Rename the selected Codex conversation. Opens the Chat actions menu → "Rename chat", then types the new title.

Arguments:
  --title <str> (required) — New title (single line, no newlines)
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `send`
Send text/commands to the current or selected Codex AI composer

Arguments:
  --text <str> (required) — Text, command (e.g. /review), or skill (e.g. $imagegen)
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select

#### `unpin`
Unpin the selected Codex conversation via the Chat actions header menu.

Arguments:
  --project <str> (optional) — Project label or path to select before running the command
  --conversation <str> (optional) — Conversation title to select within --project
  --index <str> (optional) — 1-based conversation index within --project
  --thread-id <str> (optional) — Exact Codex thread id to select


## coingecko

### Read Commands

#### `categories`
Crypto categories ranked by aggregated market cap

Arguments:
  --sort <str> (optional) — Sort order (market_cap_desc / market_cap_asc / name_desc / name_asc / market_cap_change_24h_desc / market_cap_change_24h_asc)
  --limit <int> (optional) — Number of categories (1-100; CoinGecko returns ~120 max)

#### `coin`
Fetch a single cryptocurrency's market data by CoinGecko id (e.g. bitcoin, ethereum).

Arguments:
  --id <string> (required) — CoinGecko coin id (lowercase, e.g. bitcoin / ethereum / solana).
  --currency <string> (optional) — Quote currency (usd, cny, eur, jpy, ...).

#### `derivatives`
Top crypto derivative (perpetual / futures) markets by 24h volume

Arguments:
  --limit <int> (optional) — Max rows to return (1-500; CoinGecko returns one large page).
  --symbol <string> (optional) — Optional symbol substring filter (e.g. "BTC", "ETHUSDT").

#### `exchanges`
Top crypto exchanges by 24h BTC trading volume

Arguments:
  --limit <int> (optional) — Number of exchanges (1-250, CoinGecko per_page upper bound)
  --page <int> (optional) — Page number (1-based)

#### `global`
Aggregate crypto market stats: total market cap, volume, dominance

Arguments:
  --currency <string> (optional) — Quote currency for total market cap / volume (usd, cny, eur, jpy, ...)

#### `top`
Cryptocurrency quotes by market cap (default USD)

Arguments:
  --currency <string> (optional) — quote currency (usd / cny / eur / jpy ...)
  --limit <int> (optional) — Number to return (default 10, maximum 250)

#### `trending`
Top trending cryptocurrencies on CoinGecko in the last 24h (search-volume based).


## confluence

### Read Commands

#### `page`
Confluence page by id with storage and Markdown body

Arguments:
  --id <str> (required) — Confluence page id

#### `search`
Search Confluence content with CQL

Arguments:
  --cql <str> (required) — CQL query, e.g. "type = page and title ~ \"RCA\""
  --space <string> (optional) — Limit search to a Confluence space key
  --limit <int> (optional) — Max results to return (1-100)

### Write Commands ⚠️

#### `create`
Create a Confluence page from Markdown or storage XHTML

Arguments:
  --space <string> (required) — Cloud space id, or Data Center space key
  --title <string> (required) — Page title
  --file <string> (required) — Markdown file path
  --parent <string> (optional) — Optional parent page id
  --representation <string> (optional) [markdown|storage] — Input file format
  --execute <boolean> (optional) — Actually create the remote page

#### `update`
Update a Confluence page body from Markdown or storage XHTML

Arguments:
  --id <str> (required) — Confluence page id
  --file <string> (required) — Markdown file path
  --title <string> (optional) — Optional replacement title; defaults to current title
  --version-message <string> (optional) — Confluence version message
  --representation <string> (optional) [markdown|storage] — Input file format
  --execute <boolean> (optional) — Actually update the remote page


## coupang

### Read Commands

#### `product`
Read full product detail (price, rating, seller, delivery) for a Coupang product

Arguments:
  --product-id <str> (optional) — Coupang product ID (digits only)
  --url <str> (optional) — Canonical Coupang product URL (alternative to --product-id)

#### `search`
Search Coupang products with logged-in browser session

Arguments:
  --query <str> (required) — Search keyword
  --page <int> (optional) — Search result page number
  --limit <int> (optional) — Max results (max 50)
  --filter <str> (optional) — Optional search filter (currently supports: rocket)

#### `whoami`
Show the current logged-in coupang account

### Write Commands ⚠️

#### `add-to-cart`
Add a Coupang product to cart using logged-in browser session

Arguments:
  --product-id <str> (optional) — Coupang product ID
  --url <str> (optional) — Canonical product URL

#### `login`
Open coupang login


## crates

### Read Commands

#### `crate`
Single crates.io crate metadata (latest version, downloads, license, repo)

Arguments:
  --name <str> (required) — crates.io crate name (e.g. "serde", "tokio")

#### `search`
Search the public crates.io registry by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "serde", "async runtime")
  --limit <int> (optional) — Max results (1-100)


## cursor

### Read Commands

#### `dump`
Dump the DOM and Accessibility tree of cursor for reverse-engineering

#### `export`
Export the current cursor conversation to a Markdown file

Arguments:
  --output <str> (optional) — Output file (default: /tmp/cursor-export.md)

#### `extract-code`
Extract multi-line code blocks from the current Cursor conversation

#### `history`
List recent chat sessions from the Cursor sidebar

#### `model`
Get or switch the currently active AI model in Cursor

Arguments:
  --model-name <str> (optional) — The ID of the model to switch to (e.g. claude-3.5-sonnet)

#### `read`
Read the current Cursor chat/composer conversation history

#### `screenshot`
Capture a snapshot of the current cursor window (DOM + Accessibility tree)

Arguments:
  --output <str> (optional) — Output file path (default: /tmp/cursor-snapshot.txt)

#### `status`
Check active CDP connection to Cursor AI Editor

### Write Commands ⚠️

#### `ask`
Send a prompt and wait for the AI response (send + wait + read)

Arguments:
  --text <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds to wait for response (default: 30)

#### `composer`
Send a prompt directly into Cursor Composer (Cmd+I shortcut)

Arguments:
  --text <str> (required) — Text to send into Composer

#### `new`
Start a new Cursor chat or Composer session

#### `send`
Send a prompt directly into Cursor Composer/Chat

Arguments:
  --text <str> (required) — Text to send into Cursor


## dblp

### Read Commands

#### `author`
List dblp publications by a given author (newest first; resolves to top PID match)

Arguments:
  --author <str> (optional) — Author name (e.g. "Yoshua Bengio"). Optional when --pid is given.
  --pid <str> (optional) — Canonical dblp PID (e.g. "56/953"). Bypasses author search.
  --limit <int> (optional) — Max publications (1-200)

#### `paper`
Fetch a dblp record by canonical key (e.g. conf/nips/VaswaniSPUJGKP17)

Arguments:
  --key <str> (required) — dblp record key (round-tripped from the `key` column of `dblp search`)

#### `search`
Search dblp computer-science bibliography by free-text query

Arguments:
  --query <str> (required) — Search keyword (title / author / venue, e.g. "attention is all you need")
  --limit <int> (optional) — Max results (1-100, single dblp page)

#### `venue`
Search dblp venue registry (conferences / journals) by name or acronym

Arguments:
  --query <str> (required) — Venue name or acronym (e.g. "ICLR", "neural networks")
  --limit <int> (optional) — Max venues (1-100, single dblp page)


## defillama

### Read Commands

#### `protocol`
Single DefiLlama protocol details (current TVL, mcap, chains, twitter, github, description)

Arguments:
  --slug <string> (required) — DefiLlama protocol slug (e.g. "aave", "lido")

#### `protocols`
Top DeFi protocols on DefiLlama by current TVL (slug, name, category, TVL, mcap, change_1d/7d, chains)

Arguments:
  --limit <int> (optional) — Number of rows to return (1-500)


## devto

### Read Commands

#### `latest`
Newest dev.to articles (firehose, all tags)

Arguments:
  --limit <int> (optional) — Articles per page (1-100)
  --page <int> (optional) — Page number (1-based)

#### `read`
Read a DEV.to article body by id

Arguments:
  --id <str> (required) — DEV.to article id (numeric, e.g. 3605688)
  --max-length <int> (optional) — Max characters of body to return (min 100)

#### `tag`
Latest DEV.to articles for a specific tag

Arguments:
  --tag <str> (required) — Tag name (e.g. javascript, python, webdev)
  --limit <int> (optional) — Number of articles

#### `top`
Top DEV.to articles of the day

Arguments:
  --limit <int> (optional) — Number of articles

#### `user`
Recent DEV.to articles from a specific user

Arguments:
  --username <str> (required) — DEV.to username (e.g. ben, thepracticaldev)
  --limit <int> (optional) — Number of articles


## dictionary

### Read Commands

#### `examples`
Read real-world example sentences utilizing the word

Arguments:
  --word <string> (required) — Word to get example sentences for

#### `search`
Search the Free Dictionary API for definitions, parts of speech, and pronunciations.

Arguments:
  --word <string> (required) — Word to define (e.g., serendipity)

#### `synonyms`
Find synonyms for a specific word

Arguments:
  --word <string> (required) — Word to find synonyms for (e.g., serendipity)


## discord-app

### Read Commands

#### `channels`
List channels in the current Discord server

#### `goto`
Open a Discord channel by id/name/url without sending messages

Arguments:
  --guild <str> (optional) — Guild/server id or visible name
  --channel <str> (optional) — Channel id or visible name
  --url <str> (optional) — Discord channel URL
  --timeout <str> (optional) — Seconds to wait for Discord to show the route (default: 8)

#### `members`
List online members in the current Discord channel

#### `read`
Read recent messages from the active or targeted Discord channel

Arguments:
  --count <str> (optional) — Number of messages to read (default: 20)
  --guild <str> (optional) — Guild/server id or visible name for targeted reads
  --channel <str> (optional) — Channel id or visible name for targeted reads
  --url <str> (optional) — Discord channel URL to open before reading

#### `search`
Search messages in the current Discord server/channel (Cmd+F)

Arguments:
  --query <str> (required) — Search query

#### `servers`
List all Discord servers (guilds) in the sidebar

#### `status`
Check active CDP connection to Discord Desktop

#### `thread-read`
Read recent messages from a Discord thread/post by id or URL

Arguments:
  --thread <str> (optional) — Thread/post id, or a full Discord thread/post URL
  --count <str> (optional) — Number of messages to read (default: 20)
  --guild <str> (optional) — Parent guild/server id or visible name
  --channel <str> (optional) — Parent forum/channel id or visible name
  --url <str> (optional) — Discord thread/post URL

#### `threads`
List visible Discord forum/thread posts in the active or targeted channel

Arguments:
  --limit <str> (optional) — Maximum thread/post cards to return (default: 30)
  --guild <str> (optional) — Guild/server id or visible name for targeted thread listing
  --channel <str> (optional) — Forum/channel id or visible name for targeted thread listing
  --url <str> (optional) — Discord forum/channel URL to open before listing threads

### Write Commands ⚠️

#### `delete`
Delete a message by its ID in the active Discord channel

Arguments:
  --message_id <string> (required) — The ID of the message to delete (visible via Developer Mode or the read command)

#### `send`
Send a message in the active Discord channel

Arguments:
  --text <str> (required) — Message to send


## district

### Read Commands

#### `listings`
List public District by Zomato movies, events, and nearby going-out cards

Arguments:
  --input <str> (optional) — home, movies, events, a district.in URL, or a District path
  --limit <int> (optional) — Maximum rows to return (1-100)

#### `locations`
Search District-supported cities, areas, malls, and places for booking filters

Arguments:
  --query <str> (required) — City, area, mall, or locality, for example "bangalore" or "indiranagar"
  --limit <int> (optional) — Maximum location rows to return (1-50)

#### `search`
Search District by Zomato across movies, events, dining, stores, activities, and play

Arguments:
  --query <str> (required) — Search query, for example "hamlet" or "arijit"
  --limit <int> (optional) — Maximum rows to return (1-100)
  --tab <str> (optional) — Search tab: all, dining, events, movies, stores, activities, or play

#### `seats`
List available seats for a District movie showtime

Arguments:
  --show <str> (required) — District seat-layout URL or showId from district showtimes
  --format-id <str> (optional) — District formatId from showtimes; required when show is a showId
  --content-id <str> (optional) — District content id; required when show is a showId
  --class <str> (optional) — Optional seat class filter, e.g. premium, premium xl, or recliner
  --count <int> (optional) — Number of seats to choose (1-10); without count, seats are listed normally
  --together <str> (optional) — Require selected seats to be adjacent when count is provided
  --max-price <float> (optional) — Maximum price per seat
  --limit <int> (optional) — Maximum seats to return (1-300)
  --timeout <int> (optional) — Maximum seconds to wait for the seat map to render

#### `showtimes`
List District movie showtimes with location, time, cinema, language, price, and format filters

Arguments:
  --movie <str> (required) — Movie name or District movie URL
  --date <str> (optional) — Show date in YYYY-MM-DD format; defaults to District selected date
  --city <str> (optional) — District city name/key, for example Bangalore or Bengaluru
  --near <str> (optional) — Area, mall, or locality to search near, for example Indiranagar
  --city-key <str> (optional) — Legacy District city key override, for example bengaluru
  --after <str> (optional) — Only shows at or after HH:MM, 24-hour time
  --before <str> (optional) — Only shows at or before HH:MM, 24-hour time
  --cinema <str> (optional) — Filter cinema/theatre name, for example PVR, INOX, Orion
  --language <str> (optional) — Filter movie language, for example English, Hindi, Kannada
  --max-price <float> (optional) — Only shows with at least one ticket class at or below this price
  --quality <str> (optional) — Generic format/quality filter, for example 2D, 3D, IMAX, IMAX 3D, 4DX
  --limit <int> (optional) — Maximum showtime rows to return (1-200)

#### `whoami`
Show the current logged-in district account

### Write Commands ⚠️

#### `checkout`
Select District movie seats and stop at the payment handoff page

Arguments:
  --show <str> (required) — District seat-layout URL or showId from district showtimes
  --seats <str> (required) — Comma-separated seat labels to select, e.g. I22,I21
  --format-id <str> (optional) — District formatId from showtimes; required when show is a showId
  --content-id <str> (optional) — District content id; required when show is a showId
  --timeout <int> (optional) — Maximum seconds to wait for selection and review page

#### `login`
Open district login

#### `set-location`
Set the District browser session location for movie booking filters

Arguments:
  --location <str> (required) — City, area, mall, or locality, for example "Bangalore" or "Indiranagar"
  --rank <int> (optional) — Pick the Nth District location result (1-20), default: 1
  --timeout <int> (optional) — Maximum seconds to wait for the picker and location change


## dockerhub

### Read Commands

#### `image`
Fetch a Docker Hub repository's public metadata (stars, pulls, last updated, status)

Arguments:
  --image <str> (required) — Image name (e.g. "nginx", "library/nginx", "bitnami/redis")

#### `search`
Search Docker Hub repositories by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "nginx", "bitnami redis")
  --limit <int> (optional) — Max repositories (1-100, single Docker Hub page)


## duckduckgo

### Read Commands

#### `search`
Search DuckDuckGo

Arguments:
  --keyword <str> (required) — Search query
  --limit <int> (optional) — Number of results per page (1-10). For multi-page, use --offset
  --offset <int> (optional) — Result offset for pagination (0, 10, 20...). Uses XHR POST internally
  --region <str> (optional) — Region code (e.g. jp-jp, us-en, cn-zh). Default: all regions
  --time <str> (optional) — Time range: d (day), w (week), m (month), y (year)

#### `suggest`
DuckDuckGo search suggestions

Arguments:
  --keyword <str> (required) — Search query prefix
  --limit <int> (optional) — Max number of suggestions


## endoflife

### Read Commands

#### `product`
Release cycles + EOL / LTS / support dates for one product on endoflife.date

Arguments:
  --product <string> (required) — endoflife.date product slug (e.g. "nodejs", "python", "ubuntu")


## facebook

### Read Commands

#### `events`
Browse Facebook event categories

Arguments:
  --limit <int> (optional) — Number of categories

#### `feed`
Get your Facebook news feed

Arguments:
  --limit <int> (optional) — Number of posts

#### `friends`
Get Facebook friend suggestions

Arguments:
  --limit <int> (optional) — Number of friend suggestions

#### `groups`
List your Facebook groups

Arguments:
  --limit <int> (optional) — Number of groups

#### `marketplace-inbox`
List recent Facebook Marketplace buyer/seller conversations

Arguments:
  --limit <int> (optional) — Number of conversations to return

#### `marketplace-listings`
List your Facebook Marketplace seller listings

Arguments:
  --limit <int> (optional) — Number of listings to return

#### `memories`
Get your Facebook memories (On This Day)

Arguments:
  --limit <int> (optional) — Number of memories

#### `notifications`
Get recent Facebook notifications (includes unread / time / url / notif_id / notif_type columns)

Arguments:
  --limit <int> (optional) — Number of notifications (1-100)

#### `profile`
Get Facebook user/page profile info

Arguments:
  --username <str> (required) — Facebook username or page name

#### `search`
Search Facebook for people, pages, or posts

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results

#### `whoami`
Show the current logged-in facebook account

### Write Commands ⚠️

#### `add-friend`
Send a friend request on Facebook

Arguments:
  --username <str> (required) — Facebook username or profile URL

#### `join-group`
Join a Facebook group

Arguments:
  --group <str> (required) — Group ID or URL path (e.g. '1876150192925481' or group name)

#### `login`
Open facebook login


## flathub

### Read Commands

#### `app`
Full Flathub appstream metadata for an app id (license, categories, latest release)

Arguments:
  --appId <str> (required) — AppStream id (e.g. "org.mozilla.firefox", "org.gnome.Calculator")

#### `search`
Search Flathub apps by keyword

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Max apps (1-100)


## gemini

### Read Commands

#### `deep-research-result`
Export Deep Research report URL from a Gemini conversation

Arguments:
  --query <str> (optional) — Conversation title or URL (optional; defaults to latest conversation)
  --match <str> (optional) [contains|exact] — Match mode
  --timeout <int> (optional) — Max seconds to wait for Docs export (default: 120)

#### `detail`
Open a Gemini web conversation by id, URL, or sidebar title and read its turns

Arguments:
  --id <str> (required) — Conversation id, /app/<id> URL, or sidebar title

#### `history`
List visible Gemini web conversation history from the sidebar

Arguments:
  --limit <int> (optional) — Max conversations to show

#### `models`
List available Gemini models from the web UI

#### `new`
Start a new conversation in Gemini web chat

#### `read`
Read the turns visible in the current Gemini web conversation

#### `status`
Check Gemini web page availability and login state

#### `whoami`
Show the current logged-in gemini account

### Write Commands ⚠️

#### `ask`
Send a prompt to Gemini and return only the assistant response

Arguments:
  --prompt <str> (required) — Prompt to send
  --model <string> (optional) — Gemini model to use (e.g. "2.5-flash"). Use "webcmd gemini models" to list available values.
  --timeout <int> (optional) — Max seconds to wait (default: 60)
  --new <str> (optional) — Start a new chat first (true/false, default: false)
  --thinking <str> (optional) — Thinking level: standard or extended (omitted = leave unchanged)

#### `deep-research`
Start a Gemini Deep Research run and confirm it

Arguments:
  --prompt <str> (required) — Prompt to send
  --timeout <int> (optional) — Max seconds for the overall command (default: 180; confirm-wait clamps internally to 6-20s)
  --tool <str> (optional) — Override tool label (default: Deep Research)
  --confirm <str> (optional) — Override confirm button label (default: Start research)

#### `image`
Generate images with Gemini web and save them locally

Arguments:
  --prompt <str> (required) — Image prompt to send to Gemini
  --rt <str> (optional) — Ratio shorthand for aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3)
  --st <str> (optional) — Style shorthand, e.g. anime, icon, watercolor
  --op <str> (optional) — Output directory shorthand
  --sd <boolean> (optional) — Skip download shorthand; only show Gemini page link
  --timeout <int> (optional) — Max seconds for the overall command (default: 240)

#### `login`
Open gemini login


## geogebra

### Read Commands

#### `info`
Get detailed properties of a GeoGebra object

Arguments:
  --name <str> (required) — Object label (e.g. A, c1, poly1)

#### `list`
List all geometric objects on the GeoGebra canvas

Arguments:
  --type <str> (optional) — Filter by object type (e.g. "point", "line", "circle")

### Write Commands ⚠️

#### `add-circle`
Create a circle by center+radius or center+point

Arguments:
  --center <str> (required) — Center point label (e.g. A)
  --radius <str> (optional) — Radius value (number) or a point label on the circle
  --point <str> (optional) — Alternative: a point label on the circle (use instead of --radius for Circle(center,point))

#### `add-line`
Create a line through two points or a segment between two points

Arguments:
  --points <str> (required) — Two point labels separated by comma (e.g. "A,B")
  --type <str> (optional) [line|segment|ray] — Type: line, segment, or ray (default: line)

#### `add-point`
Create a point with given label and coordinates

Arguments:
  --name <str> (required) — Point label (e.g. A, B, P1)
  --coords <str> (required) — Coordinates as x,y (e.g. "1,2")

#### `add-polygon`
Create a polygon from a list of point labels

Arguments:
  --points <str> (required) — Comma-separated point labels (e.g. "A,B,C" or "A,B,C,D")

#### `eval`
Execute one or more GeoGebra command strings (semicolon-separated)

Arguments:
  --command <str> (required) — GeoGebra command string (use ; to chain multiple commands)

#### `hexagon`
Draw a regular hexagon centered at the origin

Arguments:
  --size <str> (optional) — Radius of the hexagon (default: 2)

#### `triangle`
Draw an equilateral triangle from a horizontal base segment

Arguments:
  --size <str> (optional) — Side length of the triangle (default: 2)


## github

### Read Commands

#### `whoami`
Show the current logged-in github account

### Write Commands ⚠️

#### `login`
Open github login


## github-trending

### Read Commands

#### `repos`
GitHub Trending repositories (public, no login). Filter by --language and --since.

Arguments:
  --since <string> (optional) — Time range: daily / weekly / monthly
  --language <string> (optional) — Filter by programming language slug, e.g. python, rust, "c++"
  --limit <int> (optional) — Number of repositories to return (max 25)


## google

### Read Commands

#### `images`
Search Google Images for photos and image results

Arguments:
  --keyword <str> (required) — Image search query
  --limit <int> (optional) — Number of image results (1-100)
  --lang <str> (optional) — Language short code (e.g. en, zh)
  --resolve <bool> (optional) — Click image previews to resolve original imgurl values

#### `news`
Get Google News headlines

Arguments:
  --keyword <str> (optional) — Search query (omit for top stories)
  --limit <int> (optional) — Number of results
  --lang <str> (optional) — Language short code (e.g. en, zh)
  --region <str> (optional) — Region code (e.g. US, CN)

#### `search`
Search Google

Arguments:
  --keyword <str> (required) — Search query
  --limit <int> (optional) — Number of results (1-100)
  --lang <str> (optional) — Language short code (e.g. en, zh)

#### `suggest`
Get Google search suggestions

Arguments:
  --keyword <str> (required) — Search query
  --lang <str> (optional) — Language code

#### `trends`
Get Google Trends daily trending searches

Arguments:
  --region <str> (optional) — Region code (e.g. US, CN, JP)
  --limit <int> (optional) — Number of results


## google-scholar

### Read Commands

#### `cite`
Get citation for a Google Scholar paper

Arguments:
  --query <str> (required) — Paper title to search for
  --style <str> (optional) [bibtex|endnote|refman|refworks] — Citation format
  --index <int> (optional) — Which search result to cite (1-based)

#### `profile`
View a Google Scholar author profile

Arguments:
  --author <str> (required) — Author name or Scholar user ID (e.g. JicYPdAAAAAJ)
  --limit <int> (optional) — Max papers to show (max 20)

#### `search`
Google Scholar scholar search

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Number of results to return (max 20)


## goproxy

### Read Commands

#### `module`
Latest version + VCS origin metadata for a Go module on proxy.golang.org

Arguments:
  --module <string> (required) — Go module path (e.g. "github.com/gin-gonic/gin", "golang.org/x/net")

#### `versions`
Published version tags for a Go module (newest first), optionally with publish times

Arguments:
  --module <string> (required) — Go module path (e.g. "github.com/gin-gonic/gin")
  --limit <int> (optional) — Max rows to return (1-200)
  --with-time <boolean> (optional) — Fetch each version's publish time (one extra request per row)


## grok

### Read Commands

#### `detail`
Open a Grok conversation by ID and read its messages

Arguments:
  --id <str> (required) — Session ID (UUID) or full https://grok.com/c/<id> URL
  --markdown <boolean> (optional) — Emit assistant replies as markdown

#### `export`
Export all visible Grok conversation history metadata

Arguments:
  --limit <int> (optional) — Max conversations to export; 0 means all loaded history
  --maxScrolls <int> (optional) — Max history-list scroll rounds when limit is 0 (max 500)

#### `export-all`
Export Grok conversation history and each conversation transcript

Arguments:
  --limit <int> (optional) — Max conversations to export; 0 means all loaded history
  --offset <int> (optional) — Skip this many conversations before exporting
  --manifestPath <string> (optional) — Optional grok/export JSON manifest path; skips history dialog and visits listed /c pages directly
  --maxScrolls <int> (optional) — Max history-list scroll rounds when limit is 0 (max 500)
  --pageScrolls <int> (optional) — Max per-conversation scroll-to-bottom rounds (max 200)
  --pageTimeoutMs <int> (optional) — Max wait for each conversation page to show messages
  --delayMinMs <int> (optional) — Minimum polite delay after a conversation page loads
  --delayMaxMs <int> (optional) — Maximum polite delay after a conversation page loads

#### `history`
List recent Grok conversations from the sidebar (requires login)

Arguments:
  --limit <int> (optional) — Max conversations to show (default 20, max 100)

#### `read`
Read messages in the current Grok conversation

Arguments:
  --markdown <boolean> (optional) — Emit assistant replies as markdown

#### `status`
Check Grok page availability, login state, current session and model

#### `whoami`
Show the current logged-in grok account

### Write Commands ⚠️

#### `ask`
Send a message to Grok and get response

Arguments:
  --prompt <string> (required) — Prompt to send to Grok
  --timeout <int> (optional) — Max seconds to wait for response (default: 120)
  --new <boolean> (optional) — Start a new chat before sending (default: false)

#### `delete`
Delete a Grok conversation by ID. Grok takes effect immediately with no confirmation dialog — require --yes to actually delete.

Arguments:
  --id <string> (required) — Conversation UUID or grok.com/c/<uuid> URL
  --yes <boolean> (optional) — Actually delete (default is a dry-run preview)

#### `image`
Generate images on grok.com and return image URLs

Arguments:
  --prompt <string> (required) — Image generation prompt
  --timeout <int> (optional) — Max seconds to wait for the image (default: 240)
  --new <boolean> (optional) — Start a new chat before sending (default: false)
  --count <int> (optional) — Minimum images to wait for before returning (default: 1)
  --out <string> (optional) — Directory to save downloaded images (uses browser session to bypass auth)

#### `login`
Open grok login

#### `new`
Start a new conversation in Grok

#### `pin`
Pin a Grok conversation by ID

Arguments:
  --id <string> (required) — Conversation UUID or grok.com/c/<uuid> URL

#### `send`
Fire-and-forget: send a prompt to Grok without waiting for the reply

Arguments:
  --prompt <str> (required) — Prompt to send to Grok
  --new <boolean> (optional) — Start a new chat before sending

#### `unpin`
Unpin a Grok conversation by ID

Arguments:
  --id <string> (required) — Conversation UUID or grok.com/c/<uuid> URL


## hackernews

### Read Commands

#### `ask`
Hacker News Ask HN posts

Arguments:
  --limit <int> (optional) — Number of stories

#### `best`
Hacker News best stories

Arguments:
  --limit <int> (optional) — Number of stories

#### `jobs`
Hacker News job postings

Arguments:
  --limit <int> (optional) — Number of job postings

#### `new`
Hacker News newest stories

Arguments:
  --limit <int> (optional) — Number of stories

#### `read`
Read a Hacker News story and its comment tree

Arguments:
  --id <str> (required) — HN item ID (e.g. 39847301)
  --limit <int> (optional) — Max top-level comments
  --depth <int> (optional) — Max reply depth (1=no replies, 2=one level of replies, etc.)
  --replies <int> (optional) — Max replies shown per comment at each level
  --max-length <int> (optional) — Max characters per comment body (min 100)

#### `search`
Search Hacker News stories

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results
  --sort <str> (optional) [relevance|date] — Sort by relevance or date

#### `show`
Hacker News Show HN posts

Arguments:
  --limit <int> (optional) — Number of stories

#### `top`
Hacker News top stories

Arguments:
  --limit <int> (optional) — Number of stories

#### `user`
Hacker News user profile

Arguments:
  --username <str> (required) — HN username


## hf

### Read Commands

#### `datasets`
Top Hugging Face datasets (downloads / likes / trending / freshness).

Arguments:
  --sort <string> (optional) — Sort key: downloads, likes, trending, created_at, last_modified
  --search <string> (optional) — Optional name/owner substring filter.
  --limit <int> (optional) — Max datasets (max 100; one API page).

#### `models`
Top Hugging Face models (downloads / likes / trending / freshness).

Arguments:
  --sort <string> (optional) — Sort key: downloads, likes, trending, created_at, last_modified
  --search <string> (optional) — Optional name/owner substring filter (e.g. "llama", "mistralai/")
  --pipeline <string> (optional) — Filter by pipeline tag (e.g. text-generation, image-classification)
  --limit <int> (optional) — Max models (max 100; one API page).

#### `paper`
Hugging Face paper detail by arXiv id (full title / summary / authors / AI keywords)

Arguments:
  --id <str> (required) — arXiv id (e.g. "1706.03762") — same value HF uses to mirror the paper

#### `spaces`
Top Hugging Face Spaces (likes / created_at / last_modified).

Arguments:
  --sort <string> (optional) — Sort key: likes, created_at, last_modified
  --search <string> (optional) — Optional name/owner substring filter (e.g. "stability", "openai/")
  --sdk <string> (optional) — Filter by Space SDK: gradio / streamlit / docker / static
  --limit <int> (optional) — Max spaces (max 100; one API page).

#### `top`
Top upvoted Hugging Face papers

Arguments:
  --limit <int> (optional) — Number of papers
  --all <bool> (optional) — Return all papers (ignore limit)
  --date <str> (optional) — Date (YYYY-MM-DD), defaults to most recent
  --period <str> (optional) [daily|weekly|monthly] — Time period: daily, weekly, or monthly

#### `whoami`
Show the current logged-in hf account

### Write Commands ⚠️

#### `login`
Open hf login


## homebrew

### Read Commands

#### `cask`
Fetch a Homebrew cask's metadata (version, homepage, deprecation, download URL)

Arguments:
  --token <str> (required) — Cask token (e.g. "firefox", "visual-studio-code", "google-chrome")

#### `formula`
Fetch a Homebrew formula's metadata (version, license, deps, deprecation, source)

Arguments:
  --name <str> (required) — Formula name (e.g. "wget", "gcc@13", "imagemagick")

#### `popular`
List most-installed Homebrew formulae or casks (Homebrew's analytics ranking)

Arguments:
  --type <str> (optional) — Package type (formula / cask)
  --window <str> (optional) — Time window (30d / 90d / 365d)
  --limit <int> (optional) — Max rows (1-500)


## imdb

### Read Commands

#### `person`
Get actor or director info

Arguments:
  --id <str> (required) — IMDb person ID (nm0634240) or URL
  --limit <int> (optional) — Max filmography entries

#### `reviews`
Get user reviews for a movie or TV show

Arguments:
  --id <str> (required) — IMDb title ID (tt1375666) or URL
  --limit <int> (optional) — Number of reviews

#### `search`
Search IMDb for movies, TV shows, and people

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results

#### `title`
Get movie or TV show details

Arguments:
  --id <str> (required) — IMDb title ID (tt1375666) or URL

#### `top`
IMDb Top 250 Movies

Arguments:
  --limit <int> (optional) — Number of results

#### `trending`
IMDb Most Popular Movies

Arguments:
  --limit <int> (optional) — Number of results


## indeed

### Read Commands

#### `job`
Read the full Indeed job posting by jk (job key)

Arguments:
  --id <str> (required) — Job key (16-char hex from `indeed search`, e.g. "dccc07ac5a6a3683")

#### `search`
Indeed keyword job search (rendered DOM via browser session, US site)

Arguments:
  --query <str> (required) — Job keyword (title / skill / company)
  --location <string> (optional) — Location filter (e.g. "remote", "New York, NY", "San Francisco")
  --fromage <string> (optional) — Recency filter, days back: 1 / 3 / 7 / 14
  --sort <string> (optional) — Sort order: relevance | date
  --start <int> (optional) — Pagination offset (multiple of 10, 0-based)
  --limit <int> (optional) — Max rows to return (1-25, capped at one page)


## instagram

### Read Commands

#### `download`
Download images and videos from Instagram posts and reels

Arguments:
  --url <str> (required) — Instagram post / reel / tv URL
  --path <str> (optional) — Download directory

#### `explore`
Instagram explore/discover trending posts

Arguments:
  --limit <int> (optional) — Number of posts

#### `followers`
List followers of an Instagram user

Arguments:
  --username <str> (required) — Instagram username
  --limit <int> (optional) — Number of followers

#### `following`
List accounts an Instagram user is following

Arguments:
  --username <str> (required) — Instagram username
  --limit <int> (optional) — Number of accounts

#### `profile`
Get Instagram user profile info

Arguments:
  --username <str> (required) — Instagram username

#### `saved`
Get your saved Instagram posts (optionally from a specific collection)

Arguments:
  --limit <int> (optional) — Number of saved posts
  --collection <str> (optional) — Collection name (case-insensitive). Omit for the default "All posts" feed.

#### `search`
Search Instagram users

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results

#### `user`
Get recent posts from an Instagram user

Arguments:
  --username <str> (required) — Instagram username
  --limit <int> (optional) — Number of posts

#### `whoami`
Show the current logged-in instagram account

### Write Commands ⚠️

#### `collection-create`
Create a new Instagram saved-posts collection (folder)

Arguments:
  --name <str> (required) — Name of the collection to create

#### `collection-delete`
Delete an Instagram saved-posts collection (folder) by name or id

Arguments:
  --target <str> (required) — Collection name (case-insensitive) or numeric collection_id

#### `comment`
Comment on an Instagram post

Arguments:
  --username <str> (required) — Username of the post author
  --text <str> (required) — Comment text
  --index <int> (optional) — Post index (1 = most recent)

#### `follow`
Follow an Instagram user

Arguments:
  --username <str> (required) — Instagram username to follow

#### `like`
Like an Instagram post

Arguments:
  --username <str> (required) — Username of the post author
  --index <int> (optional) — Post index (1 = most recent)

#### `login`
Open instagram login

#### `note`
Publish a text Instagram note

Arguments:
  --content <str> (required) — Note text (max 60 characters)
  --timeout <int> (optional) — Max seconds for the overall command (default: 120)

#### `post`
Post an Instagram feed image or mixed-media carousel

Arguments:
  --media <str> (optional) — Comma-separated media paths (images/videos, up to 10)
  --content <str> (optional) — Caption text
  --timeout <int> (optional) — Max seconds for the overall command (default: 300)

#### `reel`
Post an Instagram reel video

Arguments:
  --video <str> (optional) — Path to a single .mp4 video file
  --content <str> (optional) — Caption text
  --timeout <int> (optional) — Max seconds for the overall command (default: 600)

#### `save`
Save (bookmark) an Instagram post

Arguments:
  --username <str> (required) — Username of the post author
  --index <int> (optional) — Post index (1 = most recent)

#### `story`
Post a single Instagram story image or video

Arguments:
  --media <str> (optional) — Path to a single story image or video file
  --timeout <int> (optional) — Max seconds for the overall command (default: 300)

#### `unfollow`
Unfollow an Instagram user

Arguments:
  --username <str> (required) — Instagram username to unfollow

#### `unlike`
Unlike an Instagram post

Arguments:
  --username <str> (required) — Username of the post author
  --index <int> (optional) — Post index (1 = most recent)

#### `unsave`
Unsave (remove bookmark) an Instagram post

Arguments:
  --username <str> (required) — Username of the post author
  --index <int> (optional) — Post index (1 = most recent)


## jira

### Read Commands

#### `attachments`
Jira issue attachment metadata

Arguments:
  --key <str> (required) — Jira issue key, e.g. PROJ-123

#### `comments`
Jira issue comments as Markdown

Arguments:
  --key <str> (required) — Jira issue key, e.g. PROJ-123
  --limit <int> (optional) — Max comments to return (1-100)

#### `issue`
Jira issue detail normalized for agents (description, comments, attachments, links)

Arguments:
  --key <str> (required) — Jira issue key, e.g. PROJ-123
  --comments-limit <int> (optional) — Max comments to include (1-100)

#### `links`
Jira issue links

Arguments:
  --key <str> (required) — Jira issue key, e.g. PROJ-123

#### `search`
Search Jira issues with JQL

Arguments:
  --jql <str> (required) — JQL query, e.g. "project = PROJ order by updated desc"
  --limit <int> (optional) — Max issues to return (1-100)


## lesswrong

### Read Commands

#### `comments`
Top comments on a post

Arguments:
  --url-or-id <string> (required) — Post URL or LessWrong post ID
  --limit <int> (optional) — Number of comments

#### `curated`
Curated editor's picks

Arguments:
  --limit <int> (optional) — Number of results

#### `frontpage`
Algorithmic frontpage

Arguments:
  --limit <int> (optional) — Number of results

#### `new`
Latest posts

Arguments:
  --limit <int> (optional) — Number of results

#### `read`
Read full post by URL or ID

Arguments:
  --url-or-id <string> (required) — Post URL or LessWrong post ID

#### `sequences`
List post collections

Arguments:
  --limit <int> (optional) — Number of results

#### `shortform`
Quick takes / shortform posts

Arguments:
  --limit <int> (optional) — Number of results

#### `tag`
Posts by tag

Arguments:
  --tag <string> (required) — Tag slug or name
  --limit <int> (optional) — Number of results

#### `tags`
List popular tags

Arguments:
  --limit <int> (optional) — Number of results

#### `top`
Top all-time

Arguments:
  --limit <int> (optional) — Number of results

#### `top-month`
Top this month

Arguments:
  --limit <int> (optional) — Number of results

#### `top-week`
Top this week

Arguments:
  --limit <int> (optional) — Number of results

#### `top-year`
Top this year

Arguments:
  --limit <int> (optional) — Number of results

#### `user`
User profile

Arguments:
  --username <string> (required) — LessWrong username or slug

#### `user-posts`
List a user's posts

Arguments:
  --username <string> (required) — LessWrong username or slug
  --limit <int> (optional) — Number of results


## lichess

### Read Commands

#### `top`
Top-N Lichess leaderboard for a perf type (bullet/blitz/rapid/classical/...)

Arguments:
  --perf <str> (required) — Perf type (bullet, blitz, rapid, classical, ultraBullet, chess960, ...)
  --limit <int> (optional) — Top-N rows (1-200)

#### `user`
Fetch a Lichess player profile by username (rating, perfs, counts)

Arguments:
  --username <str> (required) — Lichess username (case-insensitive)


## linkedin

### Read Commands

#### `company`
Read a LinkedIn company page: industry, size, HQ, founded, website, followers, and about text

Arguments:
  --company <string> (required) — Company universal name, /company/<name> path, or full URL

#### `connections`
List your LinkedIn first-degree connections with names, headlines, and profile URLs

Arguments:
  --limit <int> (optional) — Number of connections to return (max 500)

#### `inbox`
List LinkedIn messaging inbox conversations and unread messages

Arguments:
  --limit <int> (optional) — Maximum conversations to return (1-100)
  --unread-only <bool> (optional) — Return only conversations with unread messages

#### `job-detail`
Read one LinkedIn job page with description, apply URL, workplace type, applicants, and company metadata

Arguments:
  --job-url <string> (required) — Exact LinkedIn job URL, e.g. https://www.linkedin.com/jobs/view/123/

#### `jobs-preferences`
Read visible LinkedIn Jobs preferences and alert settings without changing them

#### `people-search`
Search standard LinkedIn (not Sales Navigator) for people by keyword. Each invocation consumes against LinkedIn's monthly Commercial Use Limit on people search; throttle accordingly.

Arguments:
  --keywords <string> (required) — People search keywords, e.g. "site reliability engineer berlin"
  --limit <int> (optional) — Maximum people to return (1-10); each query counts toward LinkedIn's monthly CUL

#### `post-analytics`
Summarize raw visible LinkedIn post counters without custom scoring or classification

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.
  --limit <int> (optional) — Maximum posts to summarize (1-100)

#### `posts`
Export visible posts from a LinkedIn profile activity page with engagement metrics

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.
  --limit <int> (optional) — Maximum posts to return (1-100)

#### `profile-analytics`
Read visible LinkedIn profile dashboard metrics such as profile views, post impressions, and search appearances

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.

#### `profile-experience`
Read visible LinkedIn profile experience entries with titles, dates, locations, skills, media, and URLs

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.

#### `profile-projects`
Read visible LinkedIn profile projects with descriptions, dates, skills, media, and URLs

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.

#### `profile-read`
Read visible LinkedIn profile sections: headline, About, experience, education, services, and featured sections

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.

#### `salesnav-inbox`
List LinkedIn Sales Navigator message conversations with API pagination

Arguments:
  --limit <number> (optional) — Maximum conversations to return (1-500)
  --max-pages <number> (optional) — Maximum Sales Navigator API pages to fetch
  --unread-only <bool> (optional) — Return only unread conversations

#### `salesnav-search`
Search LinkedIn Sales Navigator for people leads by keyword

Arguments:
  --keywords <string> (required) — People search keywords, e.g. "quality manager food manufacturing"
  --limit <number> (optional) — Maximum leads to return (1-500, fetched 25 per request)

#### `salesnav-thread`
Return full Sales Navigator message history for a thread id, Sales Navigator inbox URL, lead URL, recipient urn, or exact recipient name

Arguments:
  --thread-or-recipient <string> (required) — Sales Navigator inbox URL/thread id, Sales Navigator lead URL, recipient urn, or exact participant name
  --limit <number> (optional) — Maximum messages to return (1-500)
  --max-pages <number> (optional) — Maximum inbox pages to scan when resolving a recipient

#### `search`
Search LinkedIn jobs

Arguments:
  --query <string> (required) — Job search keywords
  --location <string> (optional) — Location text such as San Francisco Bay Area
  --limit <int> (optional) — Number of jobs to return (max 100)
  --start <int> (optional) — Result offset for pagination
  --details <bool> (optional) — Include full job description and apply URL (slower)
  --company <string> (optional) — Comma-separated company names or LinkedIn company IDs
  --experience-level <string> (optional) — Comma-separated: internship, entry, associate, mid-senior, director, executive
  --job-type <string> (optional) — Comma-separated: full-time, part-time, contract, temporary, volunteer, internship, other
  --date-posted <string> (optional) — One of: any, month, week, 24h
  --remote <string> (optional) — Comma-separated: on-site, hybrid, remote

#### `sent-invitations`
List pending LinkedIn sent invitations for CRM reconciliation

#### `services-read`
Read LinkedIn Services page details including services, overview, availability, pricing, and media titles/descriptions

Arguments:
  --profile-url <string> (optional) — LinkedIn /in/<handle>/ profile URL. Defaults to /in/me/.
  --services-url <string> (optional) — LinkedIn /services/page/<id>/ URL. If omitted, it is discovered from the profile.

#### `thread-snapshot`
Load a LinkedIn messaging thread, scroll for available history, and return a full context snapshot

Arguments:
  --thread-url <str> (required) — Exact LinkedIn messaging thread URL to open and snapshot
  --max-scrolls <number> (optional) — Maximum upward scroll attempts to load older messages
  --json <bool> (optional) — Return only JSON snapshot string in the snapshot_json field

#### `timeline`
Read LinkedIn home timeline posts

Arguments:
  --limit <int> (optional) — Number of posts to return (max 100)

#### `whoami`
Show the current logged-in linkedin account

### Write Commands ⚠️

#### `connect`
Fail-closed LinkedIn connection request sender that verifies the exact profile before optionally sending a note

Arguments:
  --profile-url <string> (required) — Exact LinkedIn profile URL to open and verify
  --expected-name <string> (required) — Expected visible profile name
  --note <string> (optional) — Optional connection note, max 300 chars
  --send <bool> (optional) — Actually click Send. Default is dry-run verification only.

#### `login`
Open linkedin login

#### `safe-send`
Fail-closed LinkedIn message sender that verifies exact thread, recipient, and latest message before filling/sending

Arguments:
  --thread-url <str> (required) — Exact LinkedIn messaging thread URL to open and verify
  --expected-name <str> (required) — Expected visible recipient name in the active thread header
  --message <str> (required) — Message body to send or dry-run
  --expected-last-text <str> (optional) — Substring expected in the currently visible latest conversation context
  --expected-last-hash <str> (optional) — SHA-256 hash of expected latest visible message text
  --send <bool> (optional) — Actually click Send. Default is dry-run verification only.
  --screenshot <bool> (optional) — Capture a screenshot during verification

#### `salesnav-message`
Send or dry-run a LinkedIn Sales Navigator InMail to a lead using the Sales Navigator messaging API

Arguments:
  --recipient <string> (required) — Sales Navigator lead URL, LinkedIn /in/ URL from salesnav-search, or urn:li:fs_salesProfile:(...)
  --subject <string> (required) — InMail subject
  --body <string> (required) — InMail body
  --send <bool> (optional) — Actually send the InMail. Default is dry-run validation only.
  --copy-to-crm <bool> (optional) — Set Sales Navigator copyToCrm on the message request


## linkedin-learning

### Read Commands

#### `course`
Get LinkedIn Learning course detail by slug or course URL

Arguments:
  --slug <string> (required) — Course slug (e.g. agentic-ai-build-your-first-agentic-ai-system) or full /learning/<slug> URL

#### `search`
Search LinkedIn Learning courses, videos, and learning paths by keyword

Arguments:
  --keywords <string> (required) — Search keywords, e.g. "AI agent"
  --limit <int> (optional) — Maximum results to return (1-50)

#### `trending`
Browse LinkedIn Learning recommended courses across personalized carousels

Arguments:
  --limit <int> (optional) — Maximum results to return (1-50)

#### `whoami`
Show the current logged-in linkedin-learning account

### Write Commands ⚠️

#### `login`
Open linkedin-learning login


## lobsters

### Read Commands

#### `active`
Lobste.rs most active discussions

Arguments:
  --limit <int> (optional) — Number of stories

#### `domain`
Lobste.rs stories submitted from a specific domain

Arguments:
  --domain <str> (required) — Source domain (e.g. github.com, arxiv.org, blog.cloudflare.com)
  --limit <int> (optional) — Number of stories (1-25 — single page)

#### `hot`
Lobste.rs hottest stories

Arguments:
  --limit <int> (optional) — Number of stories

#### `newest`
Lobste.rs newest stories

Arguments:
  --limit <int> (optional) — Number of stories

#### `read`
Read a Lobste.rs story and its comment tree

Arguments:
  --id <str> (required) — Lobste.rs short_id (e.g. 6cmh6h)
  --limit <int> (optional) — Max top-level comments
  --depth <int> (optional) — Max reply depth (1=no replies, 2=one level of replies, etc.)
  --replies <int> (optional) — Max replies shown per comment at each level
  --max-length <int> (optional) — Max characters per comment body (min 100)

#### `tag`
Lobste.rs stories by tag

Arguments:
  --tag <str> (required) — Tag name (e.g. programming, rust, security, ai)
  --limit <int> (optional) — Number of stories


## manus

### Read Commands

#### `connectors`
List available Manus connectors (integrations).

Arguments:
  --limit <int> (optional) — Max connectors to return

#### `credits`
Show Manus credit balance and refresh details.

#### `list`
List Manus sessions (tasks).

Arguments:
  --limit <int> (optional) — Max sessions to return
  --archived <bool> (optional) — Include archived sessions

#### `read`
Show details for a specific Manus session.

Arguments:
  --uid <str> (required) — Session UID

#### `skills`
List Manus skills (user-added and system).

#### `status`
Show current Manus user profile and credit summary.

#### `whoami`
Show the current logged-in manus account

### Write Commands ⚠️

#### `login`
Open manus login


## maven

### Read Commands

#### `artifact`
Fetch a Maven Central artifact's version history (groupId:artifactId[:version])

Arguments:
  --coordinate <str> (required) — Maven coord "groupId:artifactId" or "groupId:artifactId:version"
  --limit <int> (optional) — Max versions (1-200, ignored when version is pinned)

#### `search`
Search Maven Central by keyword (artifact name, groupId, tag)

Arguments:
  --query <str> (required) — Search keyword (e.g. "jackson", "guava", "ai.koog")
  --limit <int> (optional) — Max artifacts (1-200)


## mdn

### Read Commands

#### `search`
Search MDN Web Docs by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "fetch", "flexbox", "Array.prototype.map")
  --limit <int> (optional) — Max results (1-50)
  --locale <str> (optional) — Doc locale (en-US default; de / es / fr / ja / ko / pt-BR / ru / zh-CN / zh-TW)


## medium

### Read Commands

#### `feed`
Medium popular posts Feed

Arguments:
  --topic <str> (optional) — Topic (for example technology, programming, ai)
  --limit <int> (optional) — Number of posts to return

#### `search`
Search Medium posts

Arguments:
  --keyword <str> (required) — Search keyword
  --limit <int> (optional) — Number of posts to return

#### `tag`
Latest Medium articles tagged with a given keyword (RSS feed)

Arguments:
  --tag <str> (required) — Lowercase tag slug (e.g. "programming", "machine-learning")
  --limit <int> (optional) — Max articles (1-25 — single RSS page)

#### `user`
Get Medium user posts

Arguments:
  --username <str> (required) — Medium username(for example @username or username)
  --limit <int> (optional) — Number of posts to return


## mercury

### Read Commands

#### `check-login`
Open Mercury reimbursements and report whether the active browser profile is logged in

#### `reimbursement-plan`
Validate Mercury reimbursement inputs and print the draft plan without opening a browser

Arguments:
  --receipt <str> (required) — Local receipt/proof file path
  --amount <str> (required) — Original-currency amount, e.g. 140.00
  --currency <str> (optional) — Original currency code
  --date <str> (required) — Expense date as YYYY-MM-DD
  --merchant <str> (required) — Merchant shown on the reimbursement
  --category <str> (optional) — Mercury expense category
  --notes <str> (required) — Business purpose / reimbursement notes
  --ocr-wait-seconds <str> (optional) — Seconds the draft command waits after receipt upload before correcting OCR fields
  --close-after-review <boolean> (optional) — For draft command: close the Review dialog after verification

### Write Commands ⚠️

#### `reimbursement-draft`
Create a Mercury reimbursement draft from a local receipt, correct OCR fields, and stop at Review

Arguments:
  --receipt <str> (required) — Local receipt/proof file path
  --amount <str> (required) — Original-currency amount, e.g. 140.00
  --currency <str> (optional) — Original currency code
  --date <str> (required) — Expense date as YYYY-MM-DD
  --merchant <str> (required) — Merchant shown on the reimbursement
  --category <str> (optional) — Mercury expense category
  --notes <str> (required) — Business purpose / reimbursement notes
  --ocr-wait-seconds <str> (optional) — Seconds to wait after receipt upload before correcting OCR-overwritten fields
  --close-after-review <boolean> (optional) — Close the Review dialog after verification; final Submit is still never clicked


## notebooklm

### Read Commands

#### `current`
Show metadata for the currently opened NotebookLM notebook tab

#### `get`
Get rich metadata for the currently opened NotebookLM notebook

#### `history`
List NotebookLM conversation history threads in the current notebook

#### `list`
List NotebookLM notebooks via in-page batchexecute RPC in the current logged-in session

#### `note-list`
List saved notes from the Studio panel of the current NotebookLM notebook

#### `notes-get`
Get one note from the current NotebookLM notebook by title from the visible note editor

Arguments:
  --note <str> (required) — Note title or id from the current notebook

#### `open`
Open one NotebookLM notebook in the adapter session by id or URL

Arguments:
  --notebook <str> (required) — Notebook id from list output, or a full NotebookLM notebook URL

#### `source-fulltext`
Get the extracted fulltext for one source in the currently opened NotebookLM notebook

Arguments:
  --source <str> (required) — Source id or title from the current notebook

#### `source-get`
Get one source from the currently opened NotebookLM notebook by id or title

Arguments:
  --source <str> (required) — Source id or title from the current notebook

#### `source-guide`
Get the guide summary and keywords for one source in the currently opened NotebookLM notebook

Arguments:
  --source <str> (required) — Source id or title from the current notebook

#### `source-list`
List sources for the currently opened NotebookLM notebook

#### `status`
Check NotebookLM page availability and login state in the current Chrome session

#### `summary`
Get the summary block from the currently opened NotebookLM notebook

#### `whoami`
Show the current logged-in notebooklm account

### Write Commands ⚠️

#### `add-source`
Add a URL, text, or local file source to an existing NotebookLM notebook

Arguments:
  --notebook <str> (required) — Notebook id from `notebooklm list` or full notebook URL
  --url <str> (optional) — Source URL to add (http/https). Pass exactly one of --url, --content, --file.
  --content <str> (optional) — Raw text content to add as a Text source (max 10 MB).
  --file <str> (optional) — Local file path to upload as a source (max 52428800 bytes; pdf / txt / md / html / docx / etc.). Uses Google Drive's 3-step resumable upload protocol.
  --title <str> (optional) — Title for the text source (default "Text Source"). Ignored for --url and --file.
  --mime-type <str> (optional) — Override the auto-detected MIME type when --file is given.
  --execute <boolean> (optional) — Actually add the remote source to the NotebookLM notebook

#### `create`
Create a new NotebookLM notebook with the given title

Arguments:
  --title <str> (required) — Notebook title (1-200 chars)
  --emoji <str> (optional) — Notebook emoji icon (default 📒)
  --execute <boolean> (optional) — Actually create the remote NotebookLM notebook

#### `generate-audio`
Trigger an Audio Overview (Deep Dive podcast) generation for a NotebookLM notebook, using all of its sources

Arguments:
  --notebook <str> (required) — Notebook id from `notebooklm list` or full notebook URL
  --execute <boolean> (optional) — Actually trigger remote NotebookLM audio generation

#### `generate-slides`
Trigger a Slide Deck (AI presentation) generation for a NotebookLM notebook, using all of its sources

Arguments:
  --notebook <str> (required) — Notebook id from `notebooklm list` or full notebook URL
  --length <str> (optional) — Slide deck length: 1=Short, 3=Default (default 3)
  --language <str> (optional) — Language code (default en)
  --execute <boolean> (optional) — Actually trigger remote NotebookLM slide deck generation

#### `login`
Open notebooklm login

#### `write-note`
Create a Studio note in an existing NotebookLM notebook with the given title and Markdown content

Arguments:
  --notebook <str> (required) — Notebook id from `notebooklm list` or full notebook URL
  --title <str> (required) — Note title (1-200 chars)
  --content <str> (required) — Note body as Markdown
  --execute <boolean> (optional) — Actually create the remote NotebookLM note


## npm

### Read Commands

#### `downloads`
Daily download counts for an npm package over a window

Arguments:
  --name <str> (required) — npm package name (e.g. "react", "@vercel/og")
  --period <str> (optional) — last-day / last-week / last-month / last-year, or YYYY-MM-DD:YYYY-MM-DD

#### `package`
Single npm package metadata (latest version, license, homepage, repository). Use `npm downloads` for stats.

Arguments:
  --name <str> (required) — npm package name (e.g. "react", "@vercel/og")

#### `search`
Search the public npm registry by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "react", "graphql client")
  --limit <int> (optional) — Max results (1-250)


## nuget

### Read Commands

#### `package`
Full NuGet package version history (catalogEntry per release)

Arguments:
  --id <str> (required) — NuGet package id (e.g. "Newtonsoft.Json", case-insensitive)

#### `search`
Search NuGet packages by keyword

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Max packages (1-1000)
  --prerelease <boolean> (optional) — Include prerelease versions


## nvd

### Read Commands

#### `cve`
NIST NVD CVE detail (description, CVSS, CWE, KEV flag)

Arguments:
  --id <str> (required) — CVE identifier (e.g. "CVE-2021-44228")


## oeis

### Read Commands

#### `search`
Search OEIS sequences by keyword or numeric pattern

Arguments:
  --query <str> (required) — Search keyword or comma-separated terms (e.g. "fibonacci", "1,1,2,3,5,8")
  --limit <int> (optional) — Max sequences (1-100)

#### `sequence`
Full OEIS sequence detail by A-number (terms, name, keywords, formula counts)

Arguments:
  --id <str> (required) — OEIS sequence id (e.g. "A000045" for Fibonacci)


## openalex

### Read Commands

#### `search`
Search OpenAlex Works (papers, books, preprints) by keyword

Arguments:
  --query <str> (required) — Search text (e.g. "transformers", "open access scholarly")
  --limit <int> (optional) — Max works (1-200, single OpenAlex page)

#### `work`
Fetch a single OpenAlex Work (paper / preprint / book) — metadata + abstract

Arguments:
  --id <str> (required) — OpenAlex Work id ("W2741809807"), DOI ("10.7717/peerj.4375"), or full URL


## openfda

### Read Commands

#### `drug-label`
Search FDA-approved drug labels (brand or generic name)

Arguments:
  --query <str> (required) — Brand or generic drug name (e.g. "aspirin", "lisinopril")
  --limit <int> (optional) — Max rows (1-25, default 5; openFDA caps anonymous tier at 25/page)

#### `food-recall`
FDA food recall and enforcement actions (most recent first)

Arguments:
  --query <str> (optional) — Free-text Lucene query (e.g. "salmonella", "listeria"); default: all recent recalls
  --status <str> (optional) — Filter by status: "Ongoing", "Completed", "Terminated"
  --classification <str> (optional) — Filter by class: "Class I" (most serious), "Class II", "Class III"
  --limit <int> (optional) — Max rows (1-100, default 10; openFDA caps anonymous tier at 100/page)


## openreview

### Read Commands

#### `author`
List OpenReview submissions by an author profile id (newest first)

Arguments:
  --profile <str> (required) — OpenReview profile id (e.g. "~Yoshua_Bengio1"). Find it on the author profile URL on openreview.net.
  --limit <int> (optional) — Max submissions (1-1000)

#### `paper`
Show full metadata for a single OpenReview paper

Arguments:
  --id <str> (required) — OpenReview note id (e.g. "5sRnsubyAK")

#### `reviews`
Show full review thread (paper + reviews + decisions) for an OpenReview forum

Arguments:
  --forum <str> (required) — OpenReview forum id (same as paper id)
  --max-length <int> (optional) — Per-row text truncation (min 200)

#### `search`
Search OpenReview papers by free-text query

Arguments:
  --query <str> (required) — Search keyword (e.g. "diffusion model")
  --limit <int> (optional) — Max results (max 50)

#### `venue`
List papers at an OpenReview venue (e.g. "ICLR 2024 oral" or full invitation id)

Arguments:
  --venue <str> (required) — Venue name ("ICLR 2024 oral") or invitation ("ICLR.cc/2025/Conference/-/Submission")
  --limit <int> (optional) — Max results (max 200)
  --offset <int> (optional) — Pagination offset


## osv

### Read Commands

#### `query`
OSV.dev vulnerabilities affecting a package (optionally pinned to a version)

Arguments:
  --package <string> (required) — Package name (e.g. "lodash", "django")
  --ecosystem <string> (required) — OSV ecosystem (npm / PyPI / Go / Maven / NuGet / RubyGems / crates.io / Packagist / ...)
  --version <string> (optional) — Pin to a specific version (e.g. "4.17.20"); omit for all known vulns
  --limit <int> (optional) — Max rows to return (1-200)

#### `vulnerability`
Single OSV.dev vulnerability detail (severity, affected packages, CVE/GHSA aliases)

Arguments:
  --id <string> (required) — OSV vulnerability id (e.g. "GHSA-29mw-wpgm-hmr9", "CVE-2020-28500")


## packagist

### Read Commands

#### `package`
Fetch a Packagist package's metadata (version, downloads, license, repo, GitHub stars)

Arguments:
  --name <str> (required) — Composer package "<vendor>/<package>" (e.g. "symfony/console", "monolog/monolog")

#### `search`
Search Packagist (PHP / Composer) packages by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "symfony", "laravel http")
  --limit <int> (optional) — Max packages (1-100, single Packagist page)


## paperreview

### Read Commands

#### `review`
Fetch a paperreview.ai review by token

Arguments:
  --token <str> (required) — Review token returned by paperreview.ai
  --timeout <int> (optional) — Max seconds for the overall command (default: 30)

### Write Commands ⚠️

#### `feedback`
Submit feedback for a paperreview.ai review token

Arguments:
  --token <str> (required) — Review token returned by paperreview.ai
  --helpfulness <int> (required) — Helpfulness score from 1 to 5
  --critical-error <str> (required) [yes|no] — Whether the review contains a critical error
  --actionable-suggestions <str> (required) [yes|no] — Whether the review contains actionable suggestions
  --additional-comments <str> (optional) — Optional free-text feedback
  --timeout <int> (optional) — Max seconds for the overall command (default: 30)

#### `submit`
Submit a PDF to paperreview.ai for review

Arguments:
  --pdf <str> (required) — Path to the paper PDF
  --email <str> (required) — Email address for the submission
  --venue <str> (optional) — Optional target venue such as ICLR or NeurIPS
  --dry-run <bool> (optional) — Validate the input and stop before remote submission
  --prepare-only <bool> (optional) — Request an upload slot but stop before uploading the PDF
  --timeout <int> (optional) — Max seconds for the overall command (default: 120)


## pixiv

### Read Commands

#### `detail`
View illustration details (tags, stats, URLs)

Arguments:
  --id <str> (required) — Illustration ID

#### `download`
Download illustration images from Pixiv

Arguments:
  --illust-id <str> (required) — Illustration ID
  --output <str> (optional) — Output directory

#### `illusts`
List a Pixiv artist's illustrations

Arguments:
  --user-id <str> (required) — Pixiv user ID
  --limit <int> (optional) — Number of results

#### `ranking`
Pixiv illustration rankings (daily/weekly/monthly)

Arguments:
  --mode <str> (optional) [daily|weekly|monthly|rookie|original|male|female|daily_r18|weekly_r18] — Ranking mode
  --page <int> (optional) — Page number
  --limit <int> (optional) — Number of results

#### `search`
Search Pixiv illustrations by keyword

Arguments:
  --query <str> (required) — Search keyword or tag
  --limit <int> (optional) — Number of results
  --order <str> (optional) [date_d|date|popular_d|popular_male_d|popular_female_d] — Sort order
  --mode <str> (optional) [all|safe|r18] — Search mode
  --page <int> (optional) — Page number

#### `user`
View Pixiv artist profile

Arguments:
  --uid <str> (required) — Pixiv user ID

#### `whoami`
Show the current logged-in pixiv account

### Write Commands ⚠️

#### `login`
Open pixiv login


## practo

### Read Commands

#### `appointment`
Show logged-in Practo Drive appointment details

Arguments:
  --appointment_id <str> (required) — Appointment id from `practo appointments`

#### `appointments`
List logged-in Practo Drive appointments

#### `book-preview`
Preview Practo booking details for a selected slot without confirming

Arguments:
  --practice_doctor_id <str> (required) — Practo practice_doctor_id
  --time <str> (required) — Slot time YYYY-MM-DD HH:mm:ss
  --profile-url <str> (optional) — Doctor profile_url from `practo search`, used to build a canonical booking URL

#### `booking-link`
Build a Practo booking URL for a selected slot without confirming it

Arguments:
  --practice_doctor_id <str> (required) — Practo practice_doctor_id
  --time <str> (required) — Slot time YYYY-MM-DD HH:mm:ss
  --profile-url <str> (optional) — Doctor profile_url from `practo search`, used to build a canonical booking URL

#### `contact`
Get Practo virtual contact number for a practice_doctor_id

Arguments:
  --practice_doctor_id <str> (required) — Practo practice_doctor_id from search results

#### `profile`
Read public details from a Practo doctor profile URL

Arguments:
  --url <str> (required) — Practo doctor profile URL

#### `search`
Search Practo doctors by specialty, city, and optional locality

Arguments:
  --specialty <str> (required) — Doctor specialty, e.g. orthopedist or dermatologist
  --city <str> (optional) — City, e.g. bangalore
  --locality <str> (optional) — Optional locality, e.g. indiranagar
  --limit <int> (optional) — Max doctors to return (1-25)

#### `slots`
List available Practo appointment slots for a practice_doctor_id

Arguments:
  --practice_doctor_id <str> (required) — Practo practice_doctor_id from search results
  --limit <int> (optional) — Max slots to return (1-25)

#### `whoami`
Show the current logged-in practo account

### Write Commands ⚠️

#### `book-confirm`
Confirm a Practo clinic visit booking after explicit confirmation

Arguments:
  --practice_doctor_id <str> (required) — Practo practice_doctor_id
  --time <str> (required) — Slot time YYYY-MM-DD HH:mm:ss
  --profile-url <str> (optional) — Doctor profile_url from `practo search`, used to build a canonical booking URL
  --confirm <boolean> (optional) — Required. Set --confirm true to create the appointment.

#### `cancel`
Cancel a logged-in Practo Drive appointment after explicit confirmation

Arguments:
  --appointment_id <str> (required) — Appointment id from `practo appointments`
  --confirm <boolean> (optional) — Required. Set --confirm true to cancel the appointment.

#### `login`
Open practo login


## producthunt

### Read Commands

#### `browse`
Best products in a Product Hunt category

Arguments:
  --category <string> (required) — Category slug, e.g. vibe-coding, ai-agents, developer-tools
  --limit <int> (optional) — Number of results (max 50)

#### `hot`
Today's top Product Hunt launches with vote counts

Arguments:
  --limit <int> (optional) — Number of results (max 50)

#### `posts`
Latest Product Hunt launches (optional category filter)

Arguments:
  --limit <int> (optional) — Number of results (max 50)
  --category <string> (optional) — Category filter: ai-agents, ai-coding-agents, ai-code-editors, ai-chatbots, ai-workflow-automation, vibe-coding, developer-tools, productivity, design-creative, marketing-sales, no-code-platforms, llms, finance, social-community, engineering-development

#### `today`
Today's Product Hunt launches (most recent day in feed)

Arguments:
  --limit <int> (optional) — Max results


## pubmed

### Read Commands

#### `article`
Get detailed information for a PubMed article by PMID

Arguments:
  --pmid <str> (required) — PubMed ID, e.g. 37780221
  --full-abstract <boolean> (optional) — Do not truncate the abstract in table output

#### `author`
Search PubMed articles by author name and optional affiliation

Arguments:
  --name <str> (required) — Author name, e.g. "Smith J"
  --limit <int> (optional) — Max results (1-100)
  --affiliation <str> (optional) — Filter by author affiliation
  --position <str> (optional) [any|first|last] — Author position: any, first, or last
  --year-from <int> (optional) — Filter publication year from
  --year-to <int> (optional) — Filter publication year to
  --sort <str> (optional) [date|relevance] — Sort by date or relevance

#### `citations`
Get PubMed citation relationships for an article

Arguments:
  --pmid <str> (required) — PubMed ID, e.g. 37780221
  --direction <str> (optional) [citedby|references] — citedby or references
  --limit <int> (optional) — Max results (1-100)

#### `clinical-trial`
Search PubMed clinical trials with a trial-study preset

Arguments:
  --query <str> (required) — Clinical topic query, e.g. "breast cancer"
  --limit <int> (optional) — Max results (1-100)
  --year-from <int> (optional) — Filter publication year from
  --year-to <int> (optional) — Filter publication year to
  --free-full-text <boolean> (optional) — Only include free full text articles
  --sort <str> (optional) [date|relevance] — Sort by date or relevance

#### `journal`
Search PubMed articles by journal name

Arguments:
  --journal <str> (required) — Journal name, e.g. "Nature" or "The Lancet"
  --limit <int> (optional) — Max results (1-100)
  --year-from <int> (optional) — Filter publication year from
  --year-to <int> (optional) — Filter publication year to
  --sort <str> (optional) [relevance|date] — Sort by relevance or date

#### `mesh`
Search PubMed articles by MeSH term

Arguments:
  --term <str> (required) — MeSH term, e.g. "Neoplasms" or "Machine Learning"
  --limit <int> (optional) — Max results (1-100)
  --major <boolean> (optional) — Only include articles where this is a major MeSH topic
  --sort <str> (optional) [relevance|date] — Sort by relevance or date

#### `related`
Find articles related to a PubMed article

Arguments:
  --pmid <str> (required) — PubMed ID, e.g. 37780221
  --limit <int> (optional) — Max results (1-100)
  --score <boolean> (optional) — Show similarity scores when available

#### `review`
Search PubMed review articles with a review preset

Arguments:
  --query <str> (required) — Review topic query, e.g. "immunotherapy"
  --limit <int> (optional) — Max results (1-100)
  --year-from <int> (optional) — Filter publication year from
  --year-to <int> (optional) — Filter publication year to
  --has-abstract <boolean> (optional) — Only include articles with abstracts
  --sort <str> (optional) [date|relevance] — Sort by date or relevance

#### `search`
Search PubMed articles with advanced filters

Arguments:
  --query <str> (required) — Search query, e.g. "machine learning cancer"
  --limit <int> (optional) — Max results (1-100)
  --author <str> (optional) — Filter by author name
  --journal <str> (optional) — Filter by journal name
  --year-from <int> (optional) — Filter publication year from
  --year-to <int> (optional) — Filter publication year to
  --article-type <str> (optional) — Filter by publication type, e.g. Review or Clinical Trial
  --has-abstract <boolean> (optional) — Only include articles with abstracts
  --free-full-text <boolean> (optional) — Only include free full text articles
  --humans-only <boolean> (optional) — Only include human studies
  --english-only <boolean> (optional) — Only include English articles
  --sort <str> (optional) [relevance|date|author|journal] — Sort by relevance, date, author, or journal


## pypi

### Read Commands

#### `downloads`
PyPI download stats for a package (recent totals or full daily history)

Arguments:
  --name <str> (required) — PyPI package name (e.g. "requests", "pandas")
  --period <str> (optional) — recent (default — 1 row, last day/week/month) or overall (1 row per day)

#### `package`
Single PyPI package metadata (latest version, license, homepage, classifiers)

Arguments:
  --name <str> (required) — PyPI package name (e.g. "requests", "pandas")


## qoder

### Read Commands

#### `account`
Click the account button (username) in the Qoder sidebar and return the visible account dropdown items.

Arguments:
  --username <str> (optional) — Username text shown in the sidebar (default: tries common short labels)

#### `credits`
Click "Credits Usage" and return the credits-usage display text.

#### `history`
List Quests visible in the Qoder sidebar. Returns title + visible metadata.

Arguments:
  --limit <int> (optional) — 

#### `more-actions`
Click the "More Actions" button and list its menu items.

#### `read`
Read messages in the current Qoder Quest. Returns role + text for each visible turn.

Arguments:
  --limit <int> (optional) — 

#### `search`
Open Qoder Search palette (⌘P), type a query, return matched options.

Arguments:
  --query <str> (required) — Search text
  --limit <int> (optional) — 

#### `status`
Check Qoder CDP connection and report the current renderer URL + title.

### Write Commands ⚠️

#### `add-workspace`
Click "Add Workspace" — opens the folder picker. Note: this opens a system file-picker dialog that Qoder controls; the actual folder selection must be done in the UI by the user.

#### `ask`
Send a prompt to Qoder and wait up to --timeout seconds for the reply (best-effort: polls for the chat turn count to grow + stabilize).

Arguments:
  --text <str> (required) — Prompt text
  --timeout <int> (optional) — Max seconds to wait

#### `knowledge`
Open the Knowledge view (Qoder's personal/team knowledge base).

#### `marketplace`
Open the Qoder Marketplace.

#### `new`
Start a new Qoder Quest (conversation). Clicks the "New Quest" button in the sidebar (or its ⌘N variant).

#### `open-editor`
Click "Open Editor" — opens the current draft in a full editor pane.

#### `open-panel`
Open / close the Qoder bottom panel (Output / Terminal / Debug Console). ⌥⌘B equivalent.

#### `prompt-enhance`
Click "Prompt Enhance" — Qoder rewrites the current composer draft for better LLM consumption.

#### `send`
Type text into the Qoder composer and click "Send message" (fire-and-forget).

Arguments:
  --text <str> (required) — Text to send

#### `settings`
Click the Settings button in the Qoder sidebar.

#### `sidebar-toggle`
Collapse / Expand the Qoder Quest List sidebar (⌘B).

#### `view-all`
Click "View all" to show all Quests.


## reddit

### Read Commands

#### `frontpage`
Reddit Frontpage / r/all

Arguments:
  --limit <int> (optional) — 

#### `home`
Reddit personalized home feed (Best, requires login)

Arguments:
  --limit <int> (optional) — Number of posts (1–100)

#### `hot`
Reddit hot posts

Arguments:
  --subreddit <str> (optional) — Subreddit name (e.g. programming). Empty for frontpage
  --limit <int> (optional) — Number of posts

#### `popular`
Reddit Popular posts (/r/popular)

Arguments:
  --limit <int> (optional) — 

#### `read`
Read a Reddit post and its comments

Arguments:
  --post-id <str> (required) — Post ID (e.g. 1abc123) or full URL
  --sort <str> (optional) — Comment sort: best, top, new, controversial, old, qa
  --limit <int> (optional) — Number of top-level comments
  --depth <int> (optional) — Max reply depth (1=no replies, 2=one level of replies, etc.)
  --replies <int> (optional) — Max replies shown per comment at each level (sorted by score)
  --max-length <int> (optional) — Max characters per comment body (min 100)
  --expand-more <bool> (optional) — Follow Reddit "more comments" stubs by calling /api/morechildren.json
  --expand-rounds <int> (optional) — Max expansion passes when --expand-more is on (1–5; each round can fan out new "more" stubs)

#### `saved`
Browse your saved Reddit posts

Arguments:
  --limit <int> (optional) — 

#### `search`
Search Reddit Posts

Arguments:
  --query <string> (required) — Reddit search query
  --subreddit <string> (optional) — Search within a specific subreddit
  --sort <string> (optional) — Sort order: relevance, hot, top, new, comments
  --time <string> (optional) — Time filter: hour, day, week, month, year, all
  --limit <int> (optional) — 

#### `subreddit`
Get posts from a specific Subreddit

Arguments:
  --name <string> (required) — Subreddit name (no `r/` prefix; e.g. `python`)
  --sort <string> (optional) — Sorting method: hot, new, top, rising, controversial
  --time <string> (optional) — Time filter for top/controversial: hour, day, week, month, year, all
  --limit <int> (optional) — 

#### `subreddit-info`
Show metadata for a Reddit subreddit (subscribers, description, created date, NSFW)

Arguments:
  --name <string> (required) — Subreddit name (no `r/` prefix needed)

#### `subscribed`
List subreddits you are subscribed to

Arguments:
  --limit <int> (optional) — Max subreddits to return (1-1000, auto-paginates)

#### `upvoted`
Browse your upvoted Reddit posts

Arguments:
  --limit <int> (optional) — 

#### `user`
View a Reddit user profile

Arguments:
  --username <string> (required) — Reddit username (no `u/` prefix needed)

#### `user-comments`
View a Reddit user's comment history

Arguments:
  --username <string> (required) — Reddit username (no `u/` prefix needed)
  --limit <int> (optional) — 

#### `user-posts`
View a Reddit user's submitted posts

Arguments:
  --username <string> (required) — Reddit username (no `u/` prefix needed)
  --limit <int> (optional) — 

#### `whoami`
Show the currently logged-in Reddit user

### Write Commands ⚠️

#### `comment`
Post a comment on a Reddit post

Arguments:
  --post-id <string> (required) — Post ID (e.g. 1abc123) or fullname (t3_xxx)
  --text <string> (required) — Comment text

#### `login`
Open reddit login

#### `reply`
Reply to a Reddit comment

Arguments:
  --comment-id <string> (required) — Comment ID (e.g. okf3s7u) or fullname (t1_xxx)
  --text <string> (required) — Reply text

#### `save`
Save or unsave a Reddit post

Arguments:
  --post-id <string> (required) — Post ID (e.g. 1abc123) or fullname (t3_xxx)
  --undo <boolean> (optional) — Unsave instead of save

#### `subscribe`
Subscribe or unsubscribe to a subreddit

Arguments:
  --subreddit <string> (required) — Subreddit name (e.g. python)
  --undo <boolean> (optional) — Unsubscribe instead of subscribe

#### `upvote`
Upvote or downvote a Reddit post

Arguments:
  --post-id <string> (required) — Post ID (e.g. 1abc123) or fullname (t3_xxx)
  --direction <string> (optional) — Vote direction: up, down, none


## rest-countries

### Read Commands

#### `country`
Look up countries by name (common / official, substring match)

Arguments:
  --name <str> (required) — Country name (e.g. "japan", "united kingdom")
  --limit <int> (optional) — Max rows (1-250)

#### `region`
List countries in a region (africa / americas / asia / europe / oceania / antarctic)

Arguments:
  --region <str> (required) — Region name (case-insensitive)
  --limit <int> (optional) — Max rows (1-250)


## reuters

### Read Commands

#### `article-detail`
Reuters Reuters article detail:title/author/body text

Arguments:
  --url <str> (required) — Reuters article URL (must be on reuters.com)

#### `search`
Reuters Reuters news search

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results (1-40)

#### `whoami`
Show the current logged-in reuters account

### Write Commands ⚠️

#### `login`
Open reuters login


## rfc

### Read Commands

#### `rfc`
Single IETF RFC metadata (title, abstract, working group, authors, std level)

Arguments:
  --number <int> (required) — RFC number (e.g. 9000, 791, 2616)


## rubygems

### Read Commands

#### `gem`
Fetch a RubyGems.org gem's metadata (version, downloads, license, links)

Arguments:
  --name <str> (required) — Gem name (e.g. "rails", "sidekiq")

#### `search`
Search RubyGems.org gems by keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "rails", "redis")
  --limit <int> (optional) — Max gems (1-100, single RubyGems page)


## semanticscholar

### Read Commands

#### `citations`
List papers that cite a Semantic Scholar paper (paginated)

Arguments:
  --id <str> (required) — paperId (40-char hex), DOI, arXiv id, or prefixed id
  --limit <int> (optional) — Max citing papers (1-1000, single Semantic Scholar page)
  --offset <int> (optional) — Page offset (0-based)

#### `paper`
Semantic Scholar paper detail (citation graph + AI tldr) by paperId, DOI, or arXiv id

Arguments:
  --id <str> (required) — paperId (40-char hex), DOI, arXiv id, or prefixed id (e.g. "ARXIV:1706.03762", "PMID:12345")

#### `recommendations`
Semantic Scholar AI-curated related papers for a paperId, DOI, or arXiv id

Arguments:
  --id <str> (required) — paperId (40-char hex), DOI, arXiv id, or prefixed id
  --limit <int> (optional) — Max recommendations (1-500)

#### `search`
Search Semantic Scholar papers by free text

Arguments:
  --query <str> (required) — Search text (e.g. "attention is all you need", "diffusion model")
  --limit <int> (optional) — Max papers (1-100, single Semantic Scholar page)


## slock

### Read Commands

#### `attachment-download`
Download an attachment to a local file. Resolves a signed CDN URL in the page, then fetches bytes node-side (no CORS).

Arguments:
  --attachmentId <str> (required) — Attachment UUID
  --out <str> (optional) — Local path to write to. Defaults to ./<attachmentId>.bin
  --server <str> (optional) — Override active server slug

#### `attachment-url`
Get a short-lived signed CDN URL for an attachment (does not download bytes).

Arguments:
  --attachmentId <str> (required) — Attachment UUID
  --server <str> (optional) — Override active server slug

#### `bookmark-list`
List bookmarks (saved messages) in the active server

Arguments:
  --limit <int> (optional) — Max results
  --offset <int> (optional) — Offset
  --server <str> (optional) — Override active server

#### `channel-files`
List files shared in a channel (GET /channels/:id/files)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --limit <int> (optional) — Max files
  --server <str> (optional) — Override active server

#### `channel-info`
Show one channel's details (GET /channels/:id)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `channel-list`
List channels in the active slock server

Arguments:
  --server <str> (optional) — Override active server (slug or id) for this call

#### `channel-members`
List members of a channel

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server (slug or id)

#### `dm-list`
List DM channels in the active server (GET /channels/dm)

Arguments:
  --server <str> (optional) — Override active server (slug or id)

#### `inbox`
List unified inbox items (channels, DMs, followed threads) that need attention.

Arguments:
  --filter <str> (optional) — all | unread | mentions
  --limit <int> (optional) — Max items (server caps at 100)
  --offset <int> (optional) — Pagination offset
  --server <str> (optional) — Override active server

#### `message-read`
Read messages in a channel or thread. Thread form: "#channel:msgIdOrShort". Use --after seq|UUID for cursor.

Arguments:
  --channel <str> (required) — channelId UUID, "#name", or "#channel:msgIdOrShort"
  --after <str> (optional) — Cursor: seq number or messageId UUID (exclusive)
  --before <str> (optional) — seq to page before
  --limit <int> (optional) — Max messages
  --no-threads <bool> (optional) — Skip /threads enrichment
  --server <str> (optional) — Override active server

#### `message-search`
Search messages

Arguments:
  --query <str> (required) — Search query
  --channel <str> (optional) — Restrict to a channel (UUID or #name)
  --limit <int> (optional) — Max results
  --server <str> (optional) — Override active server

#### `server-list`
List slock servers you belong to; marks active per localStorage slug

#### `task-get`
Fetch a task by channel + taskNumber (GET /tasks/channel/:channelId/number/:taskNumber).

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --number <str> (required) — taskNumber (per-channel integer, as shown in "task #N")
  --server <str> (optional) — Override active server

#### `task-list`
List tasks (chat tasks = messages with task fields) attached to a channel. Optional --status filter.

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --status <str> (optional) — Filter by status: todo|in_progress|in_review|done|closed
  --server <str> (optional) — Override active server

#### `task-list-server`
List tasks across all channels in the active server (GET /tasks/server). Optional --status filter.

Arguments:
  --status <str> (optional) — Filter by status: todo|in_progress|in_review|done|closed
  --server <str> (optional) — Override active server

#### `thread-list`
List followed threads in the active server (GET /channels/threads/followed)

Arguments:
  --server <str> (optional) — Override active server

#### `unread-summary`
Global unread counts across every server you belong to.

#### `whoami`
Show the current logged-in slock account

### Write Commands ⚠️

#### `attachment-upload`
Upload a local file to Slock attachments. Prints the attachmentId for use with `message-send --attach`.

Arguments:
  --file <str> (required) — Local file path to upload (single file; max 50 MB)
  --channel <str> (required) — channelId UUID or #name — server requires the attachment be scoped to a channel
  --server <str> (optional) — Override active server slug

#### `bookmark-add`
Bookmark a message (POST /channels/saved). Requires full messageId UUID.

Arguments:
  --messageId <str> (required) — Full messageId UUID (short ids rejected)
  --server <str> (optional) — Override active server

#### `bookmark-remove`
Remove a bookmark (DELETE /channels/saved/:messageId). 404 is treated as already-removed.

Arguments:
  --messageId <str> (required) — Full messageId UUID
  --server <str> (optional) — Override active server

#### `channel-archive`
Archive a channel — admin only (POST /channels/:id/archive)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `channel-create`
Create a channel — admin only (POST /channels/). Public unless --private.

Arguments:
  --name <str> (required) — Channel name
  --description <str> (optional) — Channel description / topic (≤500 chars)
  --private <bool> (optional) — Create a private channel instead of public
  --server <str> (optional) — Override active server

#### `channel-join`
Join a public channel (POST /channels/:id/join)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `channel-leave`
Leave a channel (POST /channels/:id/leave)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `channel-mark`
Mark a channel read (default), read up to --seq, or --unread.

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --seq <int> (optional) — Mark read up to this seq (omit for read-all)
  --unread <bool> (optional) — Mark the channel unread instead of read
  --server <str> (optional) — Override active server

#### `channel-unarchive`
Unarchive a channel — admin only (POST /channels/:id/unarchive). #name lookups exclude archived channels; pass the channelId UUID for archived ones.

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `inbox-done`
Mark one chat as done / clear it from the inbox (POST /channels/inbox/done)

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --server <str> (optional) — Override active server

#### `inbox-read-all`
Mark the entire inbox as read (POST /channels/inbox/read-all)

Arguments:
  --server <str> (optional) — Override active server

#### `login`
Open slock login

#### `message-send`
Send a message to a channel, DM, or thread (content sent verbatim)

Arguments:
  --target <str> (required) — "#channel", "#channel:msgIdOrShort", "dm:@name", "dm:<uuid>", or channel UUID
  --content <str> (required) — Message body (sent verbatim, no marker)
  --dry-run <bool> (optional) — Print the planned payload without sending
  --as-task <bool> (optional) — Create the message as a task (asTask)
  --attach <str> (optional) — Comma-separated attachmentId UUIDs (upload separately first)
  --server <str> (optional) — Override active server (slug or id)

#### `reaction-add`
Add an emoji reaction to a message (POST /messages/:id/reactions). Idempotent server-side.

Arguments:
  --messageId <str> (required) — Full messageId UUID (short ids rejected)
  --emoji <str> (required) — A single unicode emoji, e.g. 👍
  --server <str> (optional) — Override active server

#### `reaction-remove`
Remove your emoji reaction from a message (DELETE /messages/:id/reactions).

Arguments:
  --messageId <str> (required) — Full messageId UUID (short ids rejected)
  --emoji <str> (required) — The unicode emoji to remove, e.g. 👍
  --server <str> (optional) — Override active server

#### `server-use`
Set the active slock server (writes localStorage.slock_last_server_slug)

Arguments:
  --input <str> (required) — server slug, "#slug", or UUID id

#### `task-claim`
Claim a chat task (PATCH /tasks/:id/claim). Requires full task UUID (= message id).

Arguments:
  --taskId <str> (required) — Full task UUID (= message id; short ids rejected)
  --server <str> (optional) — Override active server

#### `task-convert`
Convert a message into a chat task (POST /tasks/convert-message). Accepts a message UUID or "#channel:shortId".

Arguments:
  --messageId <str> (required) — Full message UUID, or "#channel:shortId" (short id expanded via /messages/context)
  --server <str> (optional) — Override active server

#### `task-create`
Create a task in a channel (single title; batch 1-50 is server-supported but client surface is single — see backlog R4).

Arguments:
  --channel <str> (required) — channelId UUID or #name
  --title <str> (required) — Task title (single; batch TODO via R4)
  --desc <str> (optional) — Optional description body for the task
  --server <str> (optional) — Override active server

#### `task-delete`
Delete a chat task (DELETE /tasks/:taskId). Requires --confirm — destructive, irreversible.

Arguments:
  --taskId <str> (required) — Full task UUID (= message id; short ids rejected)
  --confirm <bool> (optional) — Required acknowledgement: deletion is irreversible
  --server <str> (optional) — Override active server

#### `task-status`
Set a task's status (PATCH /tasks/:taskId/status, body {status}). One of todo|in_progress|in_review|done|closed.

Arguments:
  --taskId <str> (required) — Full task UUID (= message id; short ids rejected)
  --status <str> (required) — One of: todo|in_progress|in_review|done|closed
  --server <str> (optional) — Override active server

#### `task-unclaim`
Release ownership of a chat task (PATCH /tasks/:id/unclaim).

Arguments:
  --taskId <str> (required) — Full task UUID (= message id; short ids rejected)
  --server <str> (optional) — Override active server

#### `thread-done`
Mark a thread as done / hide it from the active list (POST /channels/threads/done)

Arguments:
  --threadChannelId <str> (required) — Thread channel UUID (from thread-list / message-read)
  --server <str> (optional) — Override active server

#### `thread-follow`
Follow the thread on a parent message (POST /channels/threads/follow)

Arguments:
  --parentMessageId <str> (required) — Full parent messageId UUID (short ids rejected)
  --server <str> (optional) — Override active server

#### `thread-undone`
Restore a done thread to the active list (POST /channels/threads/undone)

Arguments:
  --threadChannelId <str> (required) — Thread channel UUID (from thread-list / message-read)
  --server <str> (optional) — Override active server

#### `thread-unfollow`
Stop following a thread (POST /channels/threads/unfollow)

Arguments:
  --threadChannelId <str> (required) — Thread channel UUID (from thread-list / message-read)
  --server <str> (optional) — Override active server


## spotify

### Read Commands

#### `search`
Search for tracks

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results (default: 10)

#### `status`
Show current playback status

### Write Commands ⚠️

#### `auth`
Authenticate with Spotify (OAuth — run once)

#### `next`
Skip to next track

#### `pause`
Pause playback

#### `play`
Resume playback or search and play a track/artist

Arguments:
  --query <str> (optional) — Track or artist to play (optional)

#### `prev`
Skip to previous track

#### `queue`
Add a track to the playback queue

Arguments:
  --query <str> (required) — Track to add to queue

#### `repeat`
Set repeat mode (off / track / context)

Arguments:
  --mode <str> (optional) [off|track|context] — off / track / context

#### `shuffle`
Toggle shuffle on/off

Arguments:
  --state <str> (optional) [on|off] — on or off

#### `volume`
Set playback volume (0-100)

Arguments:
  --level <int> (required) — Volume 0–100


## stackoverflow

### Read Commands

#### `bounties`
Active bounties on Stack Overflow

Arguments:
  --limit <int> (optional) — Max number of results

#### `hot`
Hot Stack Overflow questions

Arguments:
  --limit <int> (optional) — Max number of results

#### `read`
Read a Stack Overflow question with answers and comments

Arguments:
  --id <str> (required) — Stack Overflow question id (numeric, e.g. 79935770)
  --answers-limit <int> (optional) — Max answers to include (1-100; accepted answer always included first)
  --comments-limit <int> (optional) — Max comments per question/answer (1-100)
  --max-length <int> (optional) — Max characters per body / answer / comment (min 100)

#### `related`
List Stack Overflow questions related to a given question id.

Arguments:
  --id <string> (required) — Stack Overflow question id (numeric, e.g. 79935770).
  --sort <string> (optional) — Sort key: rank, activity, votes, creation (rank = SO relevance default).
  --limit <int> (optional) — Max related questions (1-100).

#### `search`
Search Stack Overflow questions

Arguments:
  --query <string> (required) — Search query
  --limit <int> (optional) — Max number of results

#### `tag`
List Stack Overflow questions tagged with a given tag (most active first).

Arguments:
  --tag <string> (required) — Tag slug (e.g. python, rust, typescript).
  --sort <string> (optional) — Sort key: activity, votes, creation, hot, week, month
  --limit <int> (optional) — Max questions to return (max 100).

#### `unanswered`
Top voted unanswered questions on Stack Overflow

Arguments:
  --limit <int> (optional) — Max number of results

#### `user`
Find Stack Overflow users by display name (highest reputation first).

Arguments:
  --name <string> (required) — Display name (or substring) to search.
  --limit <int> (optional) — Max users to return (max 100).


## steam

### Read Commands

#### `app`
Steam storefront detail for a single app id

Arguments:
  --id <str> (required) — Numeric Steam app id (e.g. "620" for Portal 2)
  --currency <str> (optional) — Storefront country code (e.g. us / cn / jp / de)

#### `search`
Search the Steam storefront by name keyword

Arguments:
  --query <str> (required) — Search keyword (e.g. "portal", "stardew")
  --limit <int> (optional) — Max results (1-50)
  --currency <str> (optional) — Storefront country code (e.g. us / cn / jp / de)

#### `top-sellers`
Steam top selling games

Arguments:
  --limit <int> (optional) — Number of games


## substack

### Read Commands

#### `feed`
Substack popular posts Feed

Arguments:
  --category <str> (optional) — Post category: all, tech, business, culture, politics, science, health
  --limit <int> (optional) — Number of posts to return

#### `publication`
Get a specific Substack Newsletter latest posts

Arguments:
  --url <str> (required) — Newsletter URL(for example https://example.substack.com)
  --limit <int> (optional) — Number of posts to return

#### `search`
Search Substack posts and newsletters

Arguments:
  --keyword <str> (required) — Search keyword
  --type <str> (optional) [posts|publications] — Search type(posts=posts, publications=Newsletter)
  --limit <int> (optional) — Number of results to return


## suno

### Read Commands

#### `list`
List recent Suno clips in your library (id, title, status, created_at, link)

Arguments:
  --limit <int> (optional) — Max clips to list (default: 20)
  --page <int> (optional) — Pagination offset, 0-based (default: 0)

#### `status`
Check Suno login, plan, credit balance, and captcha readiness

#### `whoami`
Show the current logged-in suno account

### Write Commands ⚠️

#### `download`
Download an existing Suno clip (MP3 + optional WAV/M4A/video) by id

Arguments:
  --clip <str> (required) — Clip UUID or https://suno.com/song/<id> URL
  --formats <str> (optional) — Comma-separated formats: mp3, m4a, wav, video, cover, metadata. Default: mp3,metadata
  --op <str> (optional) — Output directory (default: ~/Music/suno)
  --confirm-paid <boolean> (optional) — Required to allow paid downloads (wav). Without it, paid formats are skipped with a warning.

#### `generate`
Generate music with Suno (V5.5 chirp-fenix by default) and download clips locally

Arguments:
  --prompt <str> (optional) — Simple-mode description (ignored when --lyrics is provided)
  --lyrics <str> (optional) — Custom-mode lyrics (with [Verse]/[Chorus] metatags). Triggers Custom mode.
  --tags <str> (optional) — Custom-mode style tags (genre, BPM, instruments...). Used with --lyrics.
  --negative-tags <str> (optional) — Custom-mode style exclusions (e.g. "no vocals, no autotune"). Used with --lyrics.
  --title <str> (optional) — Song title (default: auto-derived from prompt)
  --instrumental <boolean> (optional) — No vocals
  --model <str> (optional) — Model id: chirp-fenix, chirp-bluejay, chirp-v4, chirp-v3-5. Default: chirp-fenix
  --weirdness <str> (optional) — Creative weirdness slider (0..1). Default: 0.5
  --style-weight <str> (optional) — Style adherence slider (0..1). Default: 0.5
  --formats <str> (optional) — Comma-separated download formats: mp3, m4a, wav, video, cover, metadata. Default: mp3,metadata
  --op <str> (optional) — Output directory (default: ~/Music/suno)
  --timeout <int> (optional) — Max seconds to wait for clips to finish (default: 300)
  --sd <boolean> (optional) — Skip download; only print clip ids and Suno URLs
  --confirm-paid <boolean> (optional) — Required to allow paid downloads (wav). Without it, paid formats are skipped with a warning.

#### `login`
Open suno login


## tiktok

### Read Commands

#### `creator-videos`
TikTok Studio creator content list (views/likes/comments/saves/shares)

Arguments:
  --limit <int> (optional) — Number of creator videos to return (max 250)
  --cursor <string> (optional) — Non-negative TikTok Studio pagination cursor

#### `explore`
Get trending TikTok videos from the recommend feed via page-context APIs

Arguments:
  --limit <int> (optional) — Number of videos to return (max 120)

#### `following`
List accounts the logged-in user follows on TikTok via page-context APIs

Arguments:
  --limit <int> (optional) — Number of accounts (max 200)

#### `friends`
Get TikTok friend / who-to-follow suggestions via page-context APIs

Arguments:
  --limit <int> (optional) — Number of suggestions (max 100)

#### `live`
Browse TikTok live streams via page-context APIs

Arguments:
  --limit <int> (optional) — Number of streams (max 60)

#### `notifications`
Read TikTok inbox notifications (likes, comments, mentions, followers) via page-context APIs

Arguments:
  --limit <int> (optional) — Number of notifications (max 100)
  --type <str> (optional) [all|likes|comments|mentions|followers] — Notification type

#### `profile`
Get TikTok user profile info

Arguments:
  --username <str> (required) — TikTok username (without @)

#### `search`
Search TikTok videos

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Number of results

#### `user`
Get recent videos from a TikTok user via page-context APIs

Arguments:
  --username <str> (required) — TikTok username (without @)
  --limit <int> (optional) — Number of videos to return (max 120)

#### `whoami`
Show the current logged-in tiktok account

### Write Commands ⚠️

#### `comment`
Post a comment on a TikTok video

Arguments:
  --url <str> (required) — TikTok video URL (https://www.tiktok.com/@user/video/<id>)
  --text <str> (required) — Comment text (≤150 chars)

#### `follow`
Follow a TikTok user by username

Arguments:
  --username <str> (required) — TikTok username (without @)

#### `like`
Like a TikTok video

Arguments:
  --url <str> (required) — TikTok video URL

#### `login`
Open tiktok login

#### `save`
Add a TikTok video to Favorites

Arguments:
  --url <str> (required) — TikTok video URL

#### `unfollow`
Unfollow a TikTok user by username

Arguments:
  --username <str> (required) — TikTok username (without @)

#### `unlike`
Unlike a TikTok video

Arguments:
  --url <str> (required) — TikTok video URL

#### `unsave`
Remove a TikTok video from Favorites

Arguments:
  --url <str> (required) — TikTok video URL


## trae-solo

### Read Commands

#### `automation-list`
List Trae SOLO Automation tab content. Default tab is "Configured"; pass --tab to switch.

Arguments:
  --tab <str> (optional) — Tab to view: configured / run-history / task-template
  --limit <int> (optional) — 

#### `cookies`
List cookies on the Trae SOLO renderer (JS-visible via document.cookie; httpOnly cookies not shown).

#### `extensions-list`
List VSCode extensions installed in Trae SOLO (~/.trae/extensions/extensions.json). Works while Trae is closed.

#### `history`
List Trae SOLO projects and the tasks within each (from the project-list view sidebar).

Arguments:
  --project <str> (optional) — Filter by project name (substring, case-insensitive)
  --limit <int> (optional) — Max tasks per project

#### `idb-list`
List IndexedDB databases on the Trae SOLO renderer. Trae ships an @byted/ve-rtc DB used by the Volcengine RTC voice/video infrastructure.

#### `recent-workspaces`
Show Trae SOLO's recently-opened workspaces (the File → Open Recent menu, stored under key "history.recentlyOpenedPathsList" in state.vscdb).

Arguments:
  --limit <int> (optional) — 

#### `settings-read`
Parse and pretty-print Trae SOLO user settings.json (~/Library/Application Support/TRAE SOLO/User/settings.json). Handles VSCode JSONC syntax (line comments + trailing commas).

#### `skill-category`
Filter Skills Marketplace by category. Pass --list to see categories.

Arguments:
  --name <str> (optional) — Category name (substring; case-insensitive). Common: All / Developer Tools / Data Analysis / UI Design / Content Creation / Productivity
  --list <boolean> (optional) — List available categories
  --limit <int> (optional) — 

#### `skill-fs-installed`
List INSTALLED Trae SOLO skills (managedSkills entry in ~/.trae/skill-config.json).

#### `skill-fs-list`
List all Trae SOLO skills present on disk under ~/.trae/skills/. Reads SKILL.md front-matter for descriptions. Works while Trae is closed.

Arguments:
  --limit <int> (optional) — Max rows

#### `skill-fs-show`
Print a skill's SKILL.md content + on-disk path.

Arguments:
  --name <str> (required) — Skill name (folder under ~/.trae/skills/)

#### `skill-list`
List Trae SOLO Skills — by default the Marketplace; pass --installed to list installed ones.

Arguments:
  --installed <boolean> (optional) — List installed skills instead of the marketplace
  --limit <int> (optional) — Max rows to return

#### `skill-search`
Filter Skills Marketplace by keyword.

Arguments:
  --keyword <str> (required) — Search keyword (substring)
  --limit <int> (optional) — Max rows

#### `state-get`
Read a single key from Trae SOLO's globalStorage state.vscdb. Pass --workspace <ws-id> to query a per-workspace DB instead. Returns parsed JSON if the value is JSON.

Arguments:
  --key <str> (required) — State key (use state-keys to discover)
  --workspace <str> (optional) — Workspace id (from workspaces-list) to query a per-workspace DB
  --max-bytes <int> (optional) — Truncate value to this many bytes

#### `state-keys`
List all keys present in Trae SOLO's globalStorage state.vscdb (VSCode-style UI/agent state). Pass --workspace <ws-id> to query a per-workspace DB instead. Use state-get to read a specific value. (See renderer storage-keys for browser-side LS/SS.)

Arguments:
  --filter <str> (optional) — Case-insensitive substring filter over keys
  --workspace <str> (optional) — Workspace id (from workspaces-list) to query a per-workspace DB
  --limit <int> (optional) — 

#### `status`
Check active CDP connection to Trae SOLO Desktop

#### `storage-get`
Read a single localStorage / sessionStorage value on the Trae SOLO renderer.

Arguments:
  --key <str> (required) — Storage key (use storage-keys to discover)
  --storage <str> (optional) — "local" or "session"
  --max-bytes <int> (optional) — Truncate value to this many chars

#### `storage-keys`
List localStorage / sessionStorage keys on the Trae SOLO renderer (CDP). For the on-disk VSCode state.vscdb, see state-keys.

Arguments:
  --storage <str> (optional) — "local" or "session"
  --filter <str> (optional) — Case-insensitive substring filter
  --limit <int> (optional) — Max rows to return

#### `task-fs-list`
List Trae SOLO task ids from disk (snapshot/<uuid> + agentconfig/<uuid>.json). Works while Trae is closed.

Arguments:
  --limit <int> (optional) — 

#### `task-fs-show`
Show the workspace tree at a given chat-turn ref (via git ls-tree). Pass --turn <turn-id> to pick a turn; otherwise the latest after-chat-turn ref.

Arguments:
  --task-id <str> (required) — Task UUID
  --turn <str> (optional) — Specific turn id (omit for latest after-chat-turn)
  --limit <int> (optional) — 

#### `task-fs-turns`
Show the chat-turn timeline for a Trae SOLO task as git tags (before-chat-turn-* / after-chat-turn-*).

Arguments:
  --task-id <str> (required) — Task UUID (folder name under snapshot/)
  --limit <int> (optional) — 

#### `user-rules`
Print Trae SOLO user rules (~/.trae/user_rules.md).

#### `workspaces-list`
List Trae SOLO workspaceStorage entries (~/Library/.../TRAE SOLO/User/workspaceStorage/<uuid>/), resolving each workspace.json to its single-folder path or multi-folder workspace target. Works while Trae is closed.

Arguments:
  --limit <int> (optional) — 

### Write Commands ⚠️

#### `mode`
Read or switch TRAE SOLO between Code mode and Work mode.

Arguments:
  --target <str> (optional) — Target mode: code or work. Omit to read current.

#### `model`
Read or switch the current AI model in TRAE SOLO. Without arguments, reports the current model. With <name> argument (substring, case-insensitive), switches to a matching model. Pass --list to enumerate available models.

Arguments:
  --name <str> (optional) — Target model name (substring match, case-insensitive). Omit to read current.
  --list <boolean> (optional) — List all available models (does not switch)


## trip

### Read Commands

#### `attraction`
Search Trip.com attractions and experiences by destination keyword

Arguments:
  --query <str> (required) — Destination or attraction keyword (e.g. Tokyo / Paris / Louvre)
  --limit <int> (optional) — Number of results (1-50)

#### `car`
List Trip.com car-rental vehicles for a city (category, model, seats, daily price)

Arguments:
  --city <str> (required) — Numeric Trip.com carhire city id (discover via the carhire search box)
  --limit <int> (optional) — Number of vehicles (1-50)

#### `deals`
List Trip.com live promotions from the Top Deals hub: campaign title, offer, discount, and link

Arguments:
  --limit <int> (optional) — Number of deals (1-50)

#### `flight`
Search Trip.com one-way flights by IATA route + departure date

Arguments:
  --from <str> (required) — Departure IATA code (e.g. LON / LHR)
  --to <str> (required) — Arrival IATA code (e.g. NYC / JFK)
  --date <str> (required) — Departure date (YYYY-MM-DD)
  --limit <int> (optional) — Number of flights (1-50)

#### `flight-round`
Search Trip.com round-trip flights by IATA route + depart/return dates

Arguments:
  --from <str> (required) — Departure IATA code (e.g. LON / LHR)
  --to <str> (required) — Arrival IATA code (e.g. NYC / JFK)
  --depart <str> (required) — Outbound date (YYYY-MM-DD)
  --return <str> (required) — Return date (YYYY-MM-DD)
  --limit <int> (optional) — Number of flights (1-50)

#### `hotel`
Show a Trip.com hotel detail by id (rating breakdown, amenities, check-in/out policy)

Arguments:
  --id <str> (required) — Numeric Trip.com hotel id (discover via the hotels list; e.g. 715233)

#### `hotel-search`
List Trip.com hotels for a city id + check-in/out date range

Arguments:
  --city <str> (required) — Numeric Trip.com city id (discover via the hotels search box; e.g. 338 for London)
  --checkin <str> (required) — Check-in date (YYYY-MM-DD)
  --checkout <str> (required) — Check-out date (YYYY-MM-DD)
  --limit <int> (optional) — Number of hotels (1-50)

#### `package`
Search Trip.com flight+hotel packages by route + dates; lists the package flight options priced at the bundle rate

Arguments:
  --from <str> (required) — Origin city keyword (e.g. Seoul / London / Bangkok)
  --to <str> (required) — Destination city keyword (e.g. Tokyo / Paris / Singapore)
  --depart <str> (required) — Outbound date (YYYY-MM-DD)
  --return <str> (required) — Return date (YYYY-MM-DD)
  --adults <int> (optional) — Number of adults (1-9, default 2)
  --limit <int> (optional) — Number of packages (1-50)

#### `search`
Suggest Trip.com destinations (cities, airports) for a keyword; resolves the ids the other commands take

Arguments:
  --query <str> (required) — Destination keyword (e.g. Tokyo / Bali / London)
  --limit <int> (optional) — Number of suggestions (1-50)

#### `tour`
Search Trip.com tour packages by destination keyword (private or group tours)

Arguments:
  --query <str> (required) — Destination or tour keyword (e.g. Tokyo / Kyoto / Bali)
  --type <str> (optional) — Tour line: private or group (default private)
  --limit <int> (optional) — Number of tours (1-50)

#### `train`
Show a Trip.com train route timetable (departure/arrival times, duration, changes)

Arguments:
  --from <str> (required) — Departure city (e.g. London / Paris / Shanghai)
  --to <str> (required) — Arrival city (e.g. Manchester / Lyon / Beijing)
  --country <str> (required) — Route country slug (e.g. uk / france / italy / spain / germany / china)
  --limit <int> (optional) — Number of journeys (1-50)

#### `transfer`
List Trip.com airport-transfer vehicles for a city + airport (type, seats, from-price)

Arguments:
  --city <str> (required) — Airport city (e.g. Bangkok / Beijing / Da Nang)
  --airport <str> (required) — 3-letter airport IATA code (e.g. DMK / PKX / DAD)
  --limit <int> (optional) — Number of vehicles (1-50)


## tvmaze

### Read Commands

#### `search`
TVmaze TV show search by title (returns id, name, network, premiered/ended, rating)

Arguments:
  --query <string> (required) — TV show title or fragment to search for
  --limit <int> (optional) — Max rows to return (1-50)

#### `show`
Single TVmaze TV show detail by id (network, schedule, rating, IMDB/TheTVDB cross-refs)

Arguments:
  --id <int> (required) — TVmaze show id (positive integer)


## twitter

### Read Commands

#### `article`
Fetch a Twitter Article (long-form content) and export as Markdown

Arguments:
  --tweet-id <string> (required) — Tweet ID or URL containing the article

#### `bookmark-folder`
Read the tweets inside a single Twitter/X bookmark folder. Get the folder id from `webcmd twitter bookmark-folders`.

Arguments:
  --folder-id <string> (required) — Folder id from `webcmd twitter bookmark-folders`.
  --limit <int> (optional) — Maximum number of bookmarks to return (default 20).
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the folder by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the API's native (saved-time) ordering.

#### `bookmark-folders`
List your Twitter/X bookmark folders (the user-created collections under Bookmarks). Returns folder id, name, item count, and created_at.

#### `bookmarks`
Fetch your Twitter/X bookmarks (the logged-in user's saved tweets, newest first)

Arguments:
  --limit <int> (optional) — Maximum number of bookmarks to return (default 20).
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the bookmarks by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the API's native (saved-time) ordering.

#### `device-follow`
Read the /i/timeline device-follow notification stream (tweets aggregated under a bell-icon "new posts from @userA and N others" notification)

Arguments:
  --limit <int> (optional) — Maximum number of tweets to return (1-200, default 20)
  --top-by-engagement <int> (optional) — When set to N>0, re-rank by weighted engagement and return the top N. Default 0 keeps upstream ordering.

#### `download`
Download Twitter/X media (images and videos). Provide either <username> to fetch every media item from their profile via the GraphQL UserMedia endpoint with cursor pagination, or --tweet-url to download a single tweet.

Arguments:
  --username <str> (optional) — Twitter username (with or without @) to scan their profile media. Either <username> or --tweet-url is required.
  --tweet-url <str> (optional) — Single tweet URL to download. Use this OR <username>, not both required at once.
  --limit <int> (optional) — Maximum number of media items to download when scanning a profile (default 10). Ignored when --tweet-url is used.
  --output <str> (optional) — Output directory (default ./twitter-downloads). A per-source subdir is created inside.

#### `followers`
Get accounts following a Twitter/X user (defaults to the logged-in user when no user is given)

Arguments:
  --user <string> (optional) — Twitter/X handle (with or without @). Omit to fetch followers of the currently logged-in account.
  --limit <int> (optional) — Maximum number of follower rows to return (default 50). Must be a positive integer.

#### `following`
Get accounts a Twitter/X user is following (defaults to the logged-in user when no user is given)

Arguments:
  --user <string> (optional) — Twitter/X handle (with or without @). Omit to fetch the accounts the currently logged-in user follows.
  --limit <int> (optional) — Maximum number of following rows to return (default 50). Must be a positive integer.

#### `likes`
Fetch liked tweets of a Twitter user (defaults to the logged-in user when no username is given)

Arguments:
  --username <string> (optional) — Twitter screen name (with or without @). Defaults to the logged-in user when omitted.
  --limit <int> (optional) — Maximum number of liked tweets to return (default 20).
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the liked tweets by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the API's native (recency) ordering.

#### `list-tweets`
Fetch tweets from a Twitter/X list timeline

Arguments:
  --listId <string> (required) — Numeric ID of a Twitter/X list (e.g. from `webcmd twitter lists`)
  --limit <int> (optional) — 
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the list timeline by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the list's native (recency) ordering.

#### `lists`
Get Twitter/X lists for the logged-in user (owned + subscribed)

Arguments:
  --limit <int> (optional) — Maximum number of lists to return (default 50).

#### `notifications`
Get your Twitter/X notifications (the logged-in user's likes/replies/follows feed, newest first)

Arguments:
  --limit <int> (optional) — Maximum number of notifications to return (default 20).

#### `profile`
Fetch a Twitter user profile — bio, stats, etc. (defaults to the logged-in user when no username is given)

Arguments:
  --username <string> (optional) — Twitter screen name (with or without @). Defaults to the logged-in user when omitted.

#### `search`
Search Twitter/X for tweets, with optional --from / --has / --exclude / --product filters mapped to X's search operators

Arguments:
  --query <string> (required) — Search query. Raw X operators (e.g. "exact phrase", #tag, OR, lang:en, since:YYYY-MM-DD, from:, since:) are passed through unchanged.
  --filter <string> (optional) [top|live] — Legacy alias for --product. Kept for backwards compatibility; if --product is set it wins.
  --product <string> (optional) [top|live|photos|videos] — Which X search tab to read: top (default), live (Latest), photos, videos. Maps to the f= URL param.
  --from <string> (optional) — Restrict to tweets authored by <user>. Leading @ is stripped. Equivalent to appending `from:<user>` to the query.
  --has <string> (optional) [media|images|videos|links|replies] — Restrict to tweets that have media|images|videos|links|replies. Maps to X's `filter:<has>` operator.
  --exclude <string> (optional) [replies|retweets|media|links] — Exclude tweets matching <type>: replies|retweets|media|links. Maps to X's `-filter:<x>` operator (retweets → -filter:nativeretweets).
  --limit <int> (optional) — Maximum number of tweets to return (default 15). Result count after server-side filtering.
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the results by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps X's native ordering.

#### `thread`
Get a tweet thread (original + all replies)

Arguments:
  --tweet-id <string> (required) — Tweet numeric ID (e.g. 1234567890) or full status URL
  --limit <int> (optional) — 
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the thread by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the conversation's structural ordering.

#### `timeline`
Fetch the logged-in user's home timeline (for-you algorithmic feed by default; pass --type following for the chronological feed of accounts you follow)

Arguments:
  --type <str> (optional) [for-you|following] — Which home-timeline feed to read. Default for-you (algorithmic). Use following for the chronological feed of accounts you follow.
  --limit <int> (optional) — Maximum number of tweets to return (default 20).
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the timeline by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps X's native ordering.

#### `trending`
Twitter/X trending topics

Arguments:
  --limit <int> (optional) — Number of trends to show

#### `tweets`
Fetch a Twitter user's most recent tweets (chronological, excludes pinned; defaults to the logged-in user when no username is given)

Arguments:
  --username <string> (optional) — Twitter screen name (with or without @). Defaults to the logged-in user when omitted.
  --limit <int> (optional) — Max tweets to return (1-10000; fetched across cursor pages)
  --page-delay <int> (optional) — Seconds to wait between paginated timeline requests to reduce rate-limit risk. Use 0 to disable.
  --top-by-engagement <int> (optional) — When set to N>0, re-rank the tweets by weighted engagement (likes×1 + retweets×3 + replies×2 + bookmarks×5 + log10(views+1)×0.5) and return the top N. Default 0 keeps the chronological ordering.

#### `whoami`
Show the current logged-in twitter account

### Write Commands ⚠️

#### `accept`
Auto-accept DM requests containing specific keywords

Arguments:
  --query <string> (required) — Keywords to match (comma-separated for OR, e.g. "invoice,urgent")
  --max <int> (optional) — Maximum number of requests to accept (default: 20)
  --timeout <int> (optional) — Max seconds for the overall command (default: 600 — batch op)

#### `block`
Block a Twitter user

Arguments:
  --username <string> (required) — Twitter screen name (without @)

#### `bookmark`
Bookmark a tweet

Arguments:
  --url <string> (required) — Tweet URL to bookmark

#### `delete`
Delete a specific tweet by URL

Arguments:
  --url <string> (required) — The URL of the tweet to delete

#### `follow`
Follow a Twitter user

Arguments:
  --username <string> (required) — Twitter screen name (without @)

#### `follow-batch`
Follow multiple Twitter/X users from a comma-separated username list

Arguments:
  --usernames <string> (required) — Comma-separated Twitter/X screen names, with or without @
  --delay-ms <int> (optional) — Delay between follow attempts in milliseconds

#### `hide-reply`
Hide a reply on your tweet (useful for hiding bot/spam replies)

Arguments:
  --url <string> (required) — The URL of the reply tweet to hide

#### `like`
Like a specific tweet

Arguments:
  --url <string> (required) — The URL of the tweet to like

#### `list-add`
Add a user to a Twitter/X list you own (no-op if already a member)

Arguments:
  --listId <string> (required) — Numeric ID of the list you own (e.g. from `webcmd twitter lists`)
  --username <string> (required) — Twitter/X handle to add (with or without @)

#### `list-add-batch`
Add multiple users to a Twitter/X list you own from a comma-separated username list

Arguments:
  --listId <string> (required) — Numeric ID of the list you own (e.g. from `webcmd twitter lists`)
  --usernames <string> (required) — Comma-separated Twitter/X handles to add (with or without @)
  --interval <int> (optional) — Seconds to wait between account additions (default: 5)
  --timeout <int> (optional) — Max seconds for the overall batch command (default: 600)

#### `list-create`
Create a new Twitter/X list (returns the new list id)

Arguments:
  --name <string> (required) — List name (max 25 chars)
  --description <string> (optional) — Optional list description (max 100 chars)
  --mode <string> (optional) — public | private

#### `list-delete`
Delete a Twitter/X list you own after explicit confirmation

Arguments:
  --listId <string> (required) — Numeric ID of the list you own (e.g. from `webcmd twitter lists`)
  --confirm <boolean> (optional) — Required. Set --confirm true to delete the list.
  --timeout <int> (optional) — Max seconds for the overall delete command (default: 300)

#### `list-remove`
Remove a user from a Twitter/X list you own (toggles via UI; no-op if not currently a member)

Arguments:
  --listId <string> (required) — Numeric ID of the list you own (e.g. from `webcmd twitter lists`)
  --username <string> (required) — Twitter/X handle to remove (with or without @)

#### `list-remove-batch`
Remove multiple users from a Twitter/X list you own from a comma-separated username list

Arguments:
  --listId <string> (required) — Numeric ID of the list you own (e.g. from `webcmd twitter lists`)
  --usernames <string> (required) — Comma-separated Twitter/X handles to remove (with or without @)
  --interval <int> (optional) — Seconds to wait between account removals (default: 5)
  --timeout <int> (optional) — Max seconds for the overall batch command (default: 600)

#### `login`
Open twitter login

#### `post`
Post a new tweet/thread

Arguments:
  --text <string> (required) — The text content of the tweet
  --images <string> (optional) — Image paths, comma-separated, max 4 (jpg/png/gif/webp)

#### `quote`
Quote-tweet a specific tweet with your own text, optionally with a local or remote image

Arguments:
  --url <string> (required) — The URL of the tweet to quote
  --text <string> (required) — The text content of your quote
  --image <str> (optional) — Optional local image path to attach to the quote tweet
  --image-url <str> (optional) — Optional remote image URL to download and attach to the quote tweet

#### `reply`
Reply to a specific tweet, optionally with a local or remote image

Arguments:
  --url <string> (required) — The URL of the tweet to reply to
  --text <string> (required) — The text content of your reply
  --image <str> (optional) — Optional local image path to attach to the reply
  --image-url <str> (optional) — Optional remote image URL to download and attach to the reply

#### `reply-dm`
Send a message to recent DM conversations

Arguments:
  --text <string> (required) — Message text to send (e.g. "my messaging handle wxkabi")
  --max <int> (optional) — Maximum number of conversations to reply to (default: 20)
  --skip-replied <boolean> (optional) — Skip conversations where you already sent the same text (default: true)
  --timeout <int> (optional) — Max seconds for the overall command (default: 600 — batch op)

#### `retweet`
Retweet a specific tweet

Arguments:
  --url <string> (required) — The URL of the tweet to retweet

#### `unblock`
Unblock a Twitter user

Arguments:
  --username <string> (required) — Twitter screen name (without @)

#### `unbookmark`
Remove a tweet from bookmarks

Arguments:
  --url <string> (required) — Tweet URL to unbookmark

#### `unfollow`
Unfollow a Twitter user

Arguments:
  --username <string> (required) — Twitter screen name (without @)

#### `unlike`
Remove a like from a specific tweet

Arguments:
  --url <string> (required) — The URL of the tweet to unlike

#### `unretweet`
Undo a retweet on a specific tweet

Arguments:
  --url <string> (required) — The URL of the tweet to unretweet


## uiverse

### Read Commands

#### `code`
Export Uiverse component code (HTML, CSS, React, or Vue)

Arguments:
  --input <str> (required) — Uiverse URL or author/slug identifier
  --target <str> (required) [html|css|react|vue] — Code target to export

#### `preview`
Capture a screenshot of the Uiverse preview element

Arguments:
  --input <str> (required) — Uiverse URL or author/slug identifier
  --output <str> (optional) — Output image path (defaults to a temp file)
  --padding <int> (optional) — Extra padding around the captured preview in pixels


## upwork

### Read Commands

#### `detail`
Read the full Upwork job posting by ciphertext id (e.g. ~022054964136512093518)

Arguments:
  --id <str> (required) — Job ciphertext id (~01… / ~02…) or full /jobs/~02… URL

#### `feed`
Upwork personalized jobs feed (best-matches | most-recent) — requires login

Arguments:
  --tab <str> (optional) — Feed tab: best-matches | most-recent
  --limit <int> (optional) — Max rows to return (1-50, capped at one page)

#### `search`
Upwork keyword job search (logged-in browser session, US site)

Arguments:
  --query <str> (required) — Job keyword (skill / title / company)
  --location <string> (optional) — Country/city filter (e.g. "United States", "Remote")
  --category <string> (optional) — Category uid filter (advanced; from job detail `category` slug)
  --sort <string> (optional) — Sort: recency | relevance | client_total_charge | client_total_reviews
  --page <int> (optional) — Page number (1-based)
  --per_page <int> (optional) — Rows per page (10-50, capped at one page)

#### `whoami`
Show the current logged-in upwork account

### Write Commands ⚠️

#### `login`
Open upwork login


## web

### Read Commands

#### `read`
Fetch any web page and export as Markdown

Arguments:
  --url <str> (required) — Any web page URL
  --output <str> (optional) — Output directory
  --download-images <boolean> (optional) — Download images locally
  --wait <int> (optional) — Seconds to wait after page load
  --wait-for <str> (optional) — CSS selector to wait for in the main document or same-origin iframes
  --wait-until <str> (optional) [domstable|networkidle] — Readiness policy after navigation: domstable or networkidle
  --frames <str> (optional) [same-origin|all-same-origin|none] — Iframe handling mode: relevant same-origin, all-same-origin, or none
  --diagnose <boolean> (optional) — Print render diagnostics (frames, empty containers, XHR/API-like requests) to stderr
  --stdout <boolean> (optional) — Print markdown to stdout instead of saving to a file


## wikidata

### Read Commands

#### `entity`
Fetch a Wikidata entity by Q/P/L id (label, description, aliases, claim summary)

Arguments:
  --id <str> (required) — Entity id (e.g. Q937 = Albert Einstein, P31 = instance of)
  --language <str> (optional) — Display language (ISO 639, falls back to English when missing)

#### `search`
Search Wikidata items by keyword (returns Q-IDs)

Arguments:
  --query <str> (required) — Search keyword (label / alias)
  --language <str> (optional) — Search & display language (ISO 639, e.g. en, fr, zh)
  --limit <int> (optional) — Max items (1-50)


## wikipedia

### Read Commands

#### `page`
Full plain-text extract of a Wikipedia article (optional paragraph cap).

Arguments:
  --title <string> (required) — Article title (e.g. "Transformer (machine learning model)")
  --lang <string> (optional) — Language code (en, zh, ja, de, ...).
  --paragraphs <int> (optional) — Cap to first N paragraphs (0 = full article).

#### `random`
Get a random Wikipedia article

Arguments:
  --lang <str> (optional) — Language code (e.g. en, zh, ja)

#### `search`
Search Wikipedia articles

Arguments:
  --query <str> (required) — Search keyword
  --limit <int> (optional) — Max results
  --lang <str> (optional) — Language code (e.g. en, zh, ja)

#### `summary`
Get Wikipedia article summary

Arguments:
  --title <str> (required) — Article title (e.g. "Transformer (machine learning model)")
  --lang <str> (optional) — Language code (e.g. en, zh, ja)

#### `trending`
Most-read Wikipedia articles (yesterday)

Arguments:
  --limit <int> (optional) — Max results
  --lang <str> (optional) — Language code (e.g. en, zh, ja)


## wttr

### Read Commands

#### `current`
Current weather conditions for a location (city, lat,lon, or airport code)

Arguments:
  --location <str> (required) — City name, "lat,lon", airport ICAO code, or "@domain"

#### `forecast`
Multi-day weather forecast (up to 3 days, wttr.in free tier max)

Arguments:
  --location <str> (required) — City name, "lat,lon", airport ICAO code, or "@domain"
  --days <int> (optional) — Max forecast days (1-3, wttr.in caps the response at 3 days)


## yahoo

### Read Commands

#### `search`
Search Yahoo (powered by Bing)

Arguments:
  --keyword <str> (required) — Search query
  --limit <int> (optional) — Number of results per page (max 7)
  --page <int> (optional) — Page number (1, 2, 3...). Yahoo returns ~7 results per page


## yahoo-finance

### Read Commands

#### `quote`
Yahoo Finance stock quote

Arguments:
  --symbol <str> (required) — Stock ticker (e.g. AAPL, MSFT, TSLA)


## yollomi

### Read Commands

#### `models`
List available Yollomi AI models (image, video, tools)

Arguments:
  --type <str> (optional) [all|image|video|tool] — Filter by model type

### Write Commands ⚠️

#### `background`
Generate AI background for a product/object image (5 credits)

Arguments:
  --image <str> (required) — Image URL (upload via "webcmd yollomi upload" first)
  --prompt <str> (optional) — Background description (optional)
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `edit`
Edit images with AI text prompts (Qwen image edit)

Arguments:
  --image <str> (required) — Input image URL (upload via "webcmd yollomi upload" first)
  --prompt <str> (required) — Editing instruction (e.g. "Make it look vintage")
  --model <str> (optional) [qwen-image-edit|qwen-image-edit-plus] — Edit model
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `face-swap`
Swap faces between two photos (3 credits)

Arguments:
  --source <str> (required) — Source face image URL
  --target <str> (required) — Target photo URL
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `generate`
Generate images with AI (text-to-image or image-to-image)

Arguments:
  --prompt <str> (required) — Text prompt describing the image
  --model <str> (optional) — Model ID (z-image-turbo, flux-schnell, nano-banana, flux-2-pro, ...)
  --ratio <str> (optional) [1:1|16:9|9:16|4:3|3:4] — Aspect ratio
  --image <str> (optional) — Input image URL for image-to-image (upload via "webcmd yollomi upload" first)
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URLs, skip download

#### `object-remover`
Remove unwanted objects from images (3 credits)

Arguments:
  --image <str> (required) — Image URL
  --mask <str> (required) — Mask image URL (white = area to remove)
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `remove-bg`
Remove image background with AI (free)

Arguments:
  --image <str> (required) — Image URL to remove background from
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `restore`
Restore old or damaged photos with AI (4 credits)

Arguments:
  --image <str> (required) — Image URL to restore
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `try-on`
Virtual try-on — see how clothes look on a person (3 credits)

Arguments:
  --person <str> (required) — Person photo URL (upload via "webcmd yollomi upload" first)
  --cloth <str> (required) — Clothing image URL
  --cloth-type <str> (optional) [upper|lower|overall] — Clothing type
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `upload`
Upload an image or video to Yollomi (returns URL for other commands)

Arguments:
  --file <str> (required) — Local file path to upload

#### `upscale`
Upscale image resolution with AI (1 credit)

Arguments:
  --image <str> (required) — Image URL to upscale
  --scale <str> (optional) [2|4] — Upscale factor (2 or 4)
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL

#### `video`
Generate videos with AI (text-to-video or image-to-video)

Arguments:
  --prompt <str> (required) — Text prompt describing the video
  --model <str> (optional) — Model (kling-2-1, openai-sora-2, google-veo-3-1, wan-2-5-t2v, ...)
  --image <str> (optional) — Input image URL for image-to-video
  --ratio <str> (optional) [1:1|16:9|9:16|4:3|3:4] — Aspect ratio
  --output <str> (optional) — Output directory
  --no-download <boolean> (optional) — Only show URL, skip download


## youtube

### Read Commands

#### `channel`
Get YouTube channel info and recent videos

Arguments:
  --id <str> (required) — Channel ID (UCxxxx) or handle (@name)
  --limit <int> (optional) — Max recent videos (max 30)

#### `comments`
Get YouTube video comments

Arguments:
  --url <str> (required) — YouTube video URL or video ID
  --limit <int> (optional) — Max comments (max 100)

#### `feed`
Get YouTube homepage recommended videos

Arguments:
  --limit <int> (optional) — Max videos to return (default 20, max 100)

#### `history`
Get YouTube watch history

Arguments:
  --limit <int> (optional) — Max videos to return (default 30, max 200)

#### `playlist`
Get YouTube playlist info and video list

Arguments:
  --id <str> (required) — Playlist URL or playlist ID (PLxxxxxx)
  --limit <int> (optional) — Max videos to return (default 50, max 200)

#### `search`
Search YouTube videos

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Max results (max 50)
  --type <str> (optional) — Filter type: shorts, video, channel, playlist
  --upload <str> (optional) — Upload date: hour, today, week, month, year
  --sort <str> (optional) — Sort by: relevance, date, views, rating

#### `subscriptions`
List subscribed YouTube channels

Arguments:
  --limit <int> (optional) — Max channels to return (default 50)

#### `transcript`
Get YouTube video transcript/subtitles

Arguments:
  --url <str> (required) — YouTube video URL or video ID
  --lang <str> (optional) — Language code (e.g. en, zh-Hans). Omit to auto-select
  --mode <str> (optional) — Output mode: grouped (readable paragraphs) or raw (every segment)

#### `video`
Get YouTube video metadata (title, views, description, etc.)

Arguments:
  --url <str> (required) — YouTube video URL or video ID

#### `watch-later`
Get your YouTube Watch Later queue

Arguments:
  --limit <int> (optional) — Max videos to return (default 50, max 200)

#### `whoami`
Show the current logged-in youtube account

### Write Commands ⚠️

#### `like`
Like a YouTube video

Arguments:
  --url <str> (required) — YouTube video URL or video ID

#### `login`
Open youtube login

#### `subscribe`
Subscribe to a YouTube channel

Arguments:
  --channel <str> (required) — Channel ID (UCxxxx) or handle (@name)

#### `unlike`
Remove like from a YouTube video

Arguments:
  --url <str> (required) — YouTube video URL or video ID

#### `unsubscribe`
Unsubscribe from a YouTube channel

Arguments:
  --channel <str> (required) — Channel ID (UCxxxx) or handle (@name)


## zepto

### Read Commands

#### `cart`
Read Zepto cart line items

#### `location`
Show the selected Zepto delivery location

#### `product`
Read Zepto product details

Arguments:
  --product <str> (required) — Product URL from Zepto search results

#### `search`
Search Zepto products

Arguments:
  --query <str> (required) — Search query
  --limit <int> (optional) — Maximum products to return (max 50)

#### `whoami`
Show the current logged-in zepto account

### Write Commands ⚠️

#### `add-to-cart`
Add a Zepto product to cart

Arguments:
  --product <str> (required) — Product URL from Zepto search results
  --quantity <int> (optional) — Quantity to add (max 12)

#### `checkout`
Open Zepto checkout review without placing an order

#### `login`
Open zepto login

#### `place-order`
Submit a real Zepto order only when --confirm true is passed

Arguments:
  --confirm <boolean> (optional) — Required. Set true to submit a real Zepto order/payment action.


## zlibrary

### Read Commands

#### `info`
Get book details and available download formats from a Z-Library book page

Arguments:
  --url <str> (required) — Z-Library book page URL (e.g. https://z-library.im/book/...)

#### `search`
Search Z-Library for books by title, author, ISBN, or keyword

Arguments:
  --query <str> (required) — Search keyword (title, author, ISBN, etc.)
  --limit <int> (optional) — Max results (1–25)


