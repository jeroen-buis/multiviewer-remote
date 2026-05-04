import React, { useMemo } from 'react';
import { FetchedData, Subscription, SystemInfo } from './types';
import { useStore } from './store';
import { getApiUrl } from './api';
import { ConnectionStatus } from './App';
import Modal from './components/Modal';
import useWindowSize from './hooks/useWindowSize';

const AboutTab: React.FC = () => (
    <>
        <h2>About MultiViewer Remote</h2>
        <p>
            MultiViewer Remote is a remote app designed to work only with MultiViewer for F1.
            It connects directly to your MultiViewer setup and gives you an easy way to control and explore extra race details — right from your tablet or laptop while you’re watching the race on the big screen.
        </p>
        <h3>Key Features</h3>
        <ul>
            <li><strong>Race</strong> &ndash; Key session details including the official event name, start times, weather conditions, and a visual of the track layout.</li>
            <li><strong>Leaderboard</strong> &ndash; A real-time leaderboard showing positions, intervals, gaps to the leader, and fastest lap highlights.</li>
            <li><strong>Position</strong> &ndash; A visual graph tracking driver gains and losses throughout the race.</li>
            <li><strong>Tire Strategy &amp; Stats</strong> &ndash; Visualize each driver's tire stints, see lap times per compound, and compare performance across different tire types.</li>
            <li><strong>Pitstops</strong> &ndash; Simulate the outcome of a pitstop for any driver and see their predicted new position and gap on a visual timeline.</li>
            <li><strong>Race Control</strong> &ndash; View all official race control messages, filter by driver, and see summarized views for track limit infringements and penalties.</li>
            <li><strong>Controller</strong> &ndash; Quickly switch onboard cameras and manage video players without touching your main TV setup.</li>
        </ul>
        
        <h3>Display Modes</h3>
        <p>
            The application is fully responsive and optimized for desktop, tablet, and mobile displays.
        </p>
        <p>
            In <strong>Settings</strong>, you can set the "Display Mode" to "Auto" to let the app choose the best layout for your screen size, or you can manually force a specific layout (Desktop, Tablet, or Mobile) to suit your preference.
        </p>

        <h3>Getting Help</h3>
        <p>
            Each screen includes an information icon (i) in the header next to the view's title. Tapping this icon will provide you with specific details about the features and functionality available on that screen.
        </p>

        <h3>Important</h3>
        <p>This app will not work on its own. It requires MultiViewer for F1 and communicates directly with it to provide all features.</p>
    </>
);

const GettingStartedTab: React.FC = () => {
    const [isTechDetailsModalOpen, setIsTechDetailsModalOpen] = React.useState(false);
    const technicalDetailsContent = (
        <>
            <p>Chrome is introducing a Local Network Access permission which restricts websites (even those hosted online) from making requests to private network addresses (like 192.168.x.x), loopback (e.g. localhost / 127.0.0.1), or .local domains without explicit user approval.</p>
            <ul>
                <li>Such requests are considered “local network requests” if they resolve to private IP ranges defined by RFC1918, or certain IPv6 link-local or loopback ranges.</li>
                <li>Requests must come from a secure context (HTTPS origin), to ask for this permission.</li>
                <li>When permission is granted, Chrome will exempt those local network requests from mixed-content blocking (because many local services don’t use TLS certificates).</li>
                <li>To trigger this new prompt or behavior before it becomes default, users can set the Chrome flag <code>chrome://flags/#local-network-access-check</code> to <strong>Enabled (Blocking)</strong>.</li>
            </ul>
            <hr />
            <p>
                For more technical information, see the official article from Google Chrome:
                <br />
                <a href="https://developer.chrome.com/blog/local-network-access" target="_blank" rel="noopener noreferrer">
                    https://developer.chrome.com/blog/local-network-access
                </a>
            </p>
        </>
    );

    return (
        <>
            <h2>Getting Started Guide</h2>
            <p>MultiViewer Remote requires a working setup of MultiViewer for F1. Follow the steps below to get everything connected and ready to use.</p>
            <hr />
            <h3>Step 1: Configure MultiViewer</h3>
            <h4>1. Enable API Access</h4>
            <ul>
                <li>Open <strong>Settings</strong> in MultiViewer.</li>
                <li>Scroll down to the <strong>Experimental</strong> section.</li>
                <li>Turn on “Allow all websites to access the API.”</li>
                <li>This is required so the Remote app can connect and use MultiViewer’s APIs.</li>
            </ul>
            <h4>2. Find the IP Address of the MultiViewer Machine</h4>
            <ul>
                <li>Note the local IP address of the computer where MultiViewer is running.</li>
                <li>You’ll need this later when setting up the Remote app.</li>
            </ul>
            <h4>3. Start MultiViewer</h4>
            <ul>
                <li>Launch the MultiViewer application.</li>
                <li>Open the race session you plan to watch using the standard <strong>Open Setup</strong> method. MultiViewer Remote expects all your screen to be open and from here can control them.</li>
                <li>Ensure you also open <strong>Live Timing</strong> or <strong>Replay Live Timing</strong> for the race you plan to watch. No data will be available until you do so.</li>
            </ul>
            <hr />
            <h3>Step 2: Allow Local Network Access</h3>
            <p>
                Modern browsers like Chrome and Edge include security features that protect your local network. When a website tries to connect to a device on your local network (like the computer running MultiViewer), the browser may require your permission to allow that connection.
            </p>
            <p>
                MultiViewer Remote is designed to work with this.
            </p>
            <h4>What you need to do</h4>
            <p>
                When prompted by your browser, allow access to your local network.
            </p>
            <h4>Why is this needed?</h4>
            <p>
                Even though this application is hosted on the internet, all communication happens directly on your private network. The device you are using for <strong>MultiViewer Remote</strong> (like a tablet or phone) connects directly to the computer running <strong>MultiViewer</strong>. No data is sent to the internet.
            </p>
            <p>
                Granting local network access simply allows this direct connection to work.
                <a href="#" onClick={(e) => { e.preventDefault(); setIsTechDetailsModalOpen(true); }} style={{textDecoration: 'underline dotted', color: 'var(--sidebar-active-link-bg)'}}> (Technical details)</a>
            </p>
            <hr />
            <h3>Step 3: Configure MultiViewer Remote</h3>
            <ol>
                <li>Open <strong>Settings</strong> in the Remote app.</li>
                <li>Enter the <strong>MultiViewer IP or Hostname</strong> of the computer running MultiViewer.
                    <pre><code>e.g., 192.168.1.10</code></pre>
                </li>
                <li>Save the settings.
                    <ul>
                        <li>
                            The Remote app will attempt to connect.
                        </li>
                        <li>
                            Your Browser will popup and ask for the MultiViewer Application to connect to your Local Network, please select Allow.
                        </li>
                        <li>The connection status is shown in the bottom-left corner.</li>
                        <li>If MultiViewer isn’t running yet, start it and then click the failed indicator to retry.</li>
                    </ul>
                </li>
            </ol>
            <hr />
            <h3>Step 4: Using the MultiViewer Remote App</h3>
            <ul>
                <li>Once connected, you can use the different tabs in the MultiViewer Remote app.</li>
                <li>Functionality might depend on the session type (Race, Qualifying, Practice)</li>
                <li>The <strong>Controller</strong> tab assumes you have already organized your players in MultiViewer on your TV screen.</li>
                <li>The Remote app will:
                    <ul>
                        <li>Read your MultiViewer screen layout.</li>
                        <li>Display it in the app.</li>
                        <li>Allow you to switch onboard cameras (OBC) and control key player functions.</li>
                    </ul>
                </li>
            </ul>
            <hr />
            <h3>Step 5: (Optional) Install as an App for Easy Access</h3>
            <p>Modern browsers allow you to install websites like this one as an application. This provides a more native, app-like experience, allowing you to launch it directly from your desktop, home screen, or Start Menu without the browser's address bar.</p>
            <h4>On Desktop (Chrome / Edge)</h4>
            <ul>
                <li>Look for an install icon in the address bar (usually on the right side, it might look like a screen with a downward arrow).</li>
                <li>Alternatively, in <strong>Chrome</strong>, click the main browser menu (three dots), select "Cast, Save & Share" and then select "Install MultiViewer Remote".</li>
                <li>In <strong>Edge</strong>, click the main browser menu (three dots), select "Apps" and then "Install MultiViewer Remote".</li>
            </ul>
            <h4>On Mobile (Android)</h4>
            <ul>
                <li><strong>On Chrome:</strong> You can accept when the browser asks to install the app, or tap the main browser menu (three dots) and select "Add to Home Screen".</li>
                <li><strong>On Edge:</strong> Tap the main browser menu (three dots) and then select "Add to phone".</li>
            </ul>
            <hr />
            <h3>Troubleshooting Connection Issues</h3>
            <p>If the MultiViewer Remote app cannot connect to MultiViewer, follow these steps to diagnose the problem:</p>
            <h4>1. Check Browser Settings</h4>
            <ul>
                <li>Ensure that “Local Network Access” is enabled in your browser (Chrome/Edge) as described in <strong>Step 2</strong>. This is the most common reason for connection failures.</li>
                <li>When the app first tries to connect, your browser should show a pop-up asking for permission to access your local network. Make sure you click "Allow".</li>
            </ul>
            <h4>2. Verify MultiViewer URL</h4>
            <ul>
                <li>Double-check the IP or Hostname in the <strong>Settings</strong> tab. It must point to the correct local IP address of the machine running MultiViewer (e.g., <code>192.168.1.10</code>).</li>
            </ul>
            <h4>3. Test the Connection Directly</h4>
            <ul>
                <li>Go to the <strong>Settings</strong> screen in the Remote app.</li>
                <li>Next to the "MultiViewer IP or Hostname" field, click the information icon (i).</li>
                <li>Click the "Copy" button to copy the full API URL to your clipboard.</li>
                <li>Paste this URL into a new browser tab on the same device you are using the remote on.</li>
                <li>If the connection is working, you should see a response from the Apollo Server (a GraphQL interface). If you see an error (like "This site can’t be reached"), the issue is likely with network connectivity between your devices or a firewall.</li>
            </ul>
            <h4>4. Check for Firewalls</h4>
            <ul>
                <li>A firewall on the computer running MultiViewer might be blocking incoming connections on port <code>10101</code>.</li>
                <li>Temporarily disable the firewall on the MultiViewer machine to see if that resolves the issue. If it does, create a rule to allow incoming traffic on TCP port <code>10101</code>.</li>
            </ul>
            <Modal
                isOpen={isTechDetailsModalOpen}
                onClose={() => setIsTechDetailsModalOpen(false)}
                title="Local Network Access: Technical Details"
            >
                {technicalDetailsContent}
            </Modal>
        </>
    );
};

const ReleaseNotesTab: React.FC = () => (
    <>
        <h2>Release Notes</h2>
        <h3>Version 1.5</h3>
        <ul>
            <li><strong>Bug Fix:</strong> Fixed an issue where the app could show a blank screen after a new version was deployed, particularly on Android Chrome. The service worker now always fetches the latest app shell when online, and old caches are automatically cleared on update so a stuck device unsticks itself on the next reload.</li>
        </ul>
        <hr />
        <h3>Version 1.4</h3>
        <ul>
            <li><strong>New Feature:</strong> Introduced the Weather screen, providing real-time weather data throughout the session. Includes a combined Air and Track temperature chart, wind speed, rainfall detection, humidity, and atmospheric pressure &mdash; all plotted over time with a race start marker.</li>
            <li><strong>New Feature:</strong> The Race screen now displays track layout maps for all circuits, giving a visual overview of the track alongside session information.</li>
            <li><strong>New Feature:</strong> Added a Metric/Imperial units setting. Temperature and wind speed can now be displayed in either °C/km/h or °F/mph, configurable from the Settings screen.</li>
            <li><strong>2026 Regulation Update:</strong> DRS status indicators are now automatically hidden for 2026 and later sessions, reflecting the removal of DRS from the F1 regulations.</li>
            <li><strong>Bug Fix:</strong> Fixed a crash (white screen) that occurred when opening the "Getting Started" tab on the Home screen.</li>
        </ul>
        <hr />
        <h3>Version 1.3.2</h3>
        <ul>
            <li><strong>Feature Update:</strong> The Pitstops screen is now only available for Race sessions, as the simulation data is not relevant for Practice or Qualifying.</li>
            <li><strong>UI Fix (Mobile):</strong> The "International" feed name in the mobile Controller screen is now displayed as "Main" to improve layout and fit on smaller screens.</li>
        </ul>
        <hr />
        <h3>Version 1.3.1</h3>
        <ul>
            <li><strong>Bug Fix:</strong> Corrected an issue in the Controller screen where only the fullscreen player would be displayed, hiding all other open player windows.</li>
        </ul>
        <hr />
        <h3>Version 1.3</h3>
        <ul>
            <li><strong>Feature Update:</strong> The Position screen now shows tire changes to better indicate why a driver is dropping positions.</li>
            <li><strong>UI Improvement:</strong> Added a message to the Controller screen to guide users when no player windows are open in MultiViewer.</li>
            <li><strong>Bug Fix:</strong> Addressed a layout issue in the Controller where players on monitors with negative coordinates (left or above the main screen) were not positioned correctly.</li>
        </ul>
        <hr />
        <h3>Version 1.2.1</h3>
        <ul>
            <li><strong>Bug Fix:</strong> Resolved a layout issue on mobile browsers where performing a 'pull-to-refresh' action could cause footer elements in the sidebar to be pushed off-screen.</li>
            <li><strong>Bug Fix:</strong> Fixed an issue on the Position screen where the final position dot would appear for drivers still on track. The dot now correctly appears only after a driver has finished or retired.</li>
            <li><strong>Bug Fix:</strong> Corrected the lap data representation on the Position screen, which was previously shifted one lap too early.</li>
        </ul>
        <hr />
        <h3>Version 1.2</h3>
        <ul>
            <li><strong>New Feature:</strong> Added a detailed tire history tooltip to the Leaderboard screen (both Desktop and Mobile). Tapping the tire icons now reveals stint-by-stint information, including compound, lap count, and new/used status.</li>
            <li><strong>UI Polish:</strong> Addressed a distracting UI issue where the scrollbar in the main navigation did not match the dark theme. The scrollbar is now custom-styled to blend seamlessly with the navigation sidebar for a cleaner look.</li>
            <li><strong>Mobile Pitstops:</strong> Corrected several minor visual bugs on the mobile Pitstops screen, improving layout consistency and ensuring data is displayed correctly for retired or stopped drivers.</li>
        </ul>
        <hr />
        <h3>Version 1.1</h3>
        <ul>
            <li>Improvements to Connection settings to simplify the process. This includes an automatic migration for existing users and better troubleshooting tools.</li>
            <li>Corresponding updates to the "Getting Started" guide to reflect the new, simpler connection setup.</li>
            <li>Fixed a regression in the Position Screen where retired or stopped drivers were not shown in their final classified position.</li>
        </ul>
        <hr />
        <h3>Version 1.0.2</h3>
        <ul>
            <li>Minor bugfixes and logic improvements for the Pitstop simulation feature, specifically for the Desktop/Tablet version to align its behavior with the mobile app.</li>
        </ul>
        <hr />
        <h3>Version 1.0.1</h3>
        <ul>
            <li>Updates and clarifications to the "Getting Started" documentation for easier onboarding.</li>
        </ul>
        <hr />
        <h3>Version 1.0</h3>
        <ul>
            <li><strong>Support for Mobile Devices:</strong> Introduced full support for mobile devices, with automatic layout detection.</li>
            <li>Redesigned key screens like Controller, Pitstops, and Race Control for a touch-first experience.</li>
            <li>Added Progressive Web App (PWA) support, allowing the remote to be 'installed' on a mobile home screen for easy access.</li>
            <li>Added in-app documentation for each mobile screen.</li>
        </ul>
    </>
);

type HomeScreenProps = {
  connectionStatus: ConnectionStatus;
  multiviewerUrl: string;
  subscriptionData: FetchedData<Subscription | null>;
  systemInfoData: FetchedData<SystemInfo | null>;
  versionData: FetchedData<string | null>;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ connectionStatus, multiviewerUrl, subscriptionData, systemInfoData, versionData }) => {
  const settings = useStore((state) => state.settings);
  const [activeTab, setActiveTab] = React.useState('about');
  const { width, height } = useWindowSize();

  const displayModeLabel = useMemo(() => {
    const isMobileSize = width <= 768;
    const isTabletSize = width > 768 && width <= 1024;

    if (settings.displayMode === 'mobile') {
        return 'Mobile (Forced)';
    }
    if (settings.displayMode === 'tablet') {
      return 'Tablet (Forced)';
    }
    if (settings.displayMode === 'desktop') {
      return 'Desktop (Forced)';
    }
    
    // 'auto' mode
    if (isMobileSize) {
        return 'Mobile (Auto)';
    }
    if (isTabletSize) {
        return 'Tablet (Auto)';
    }
    return 'Desktop (Auto)';
  }, [settings.displayMode, width]);

  return (
    <div>
      <h1>Home</h1>

      {connectionStatus === 'not-configured' && (
        <div className="card">
            <h2>Welcome to MultiViewer Remote!</h2>
            <p>To get started, please go to the <strong>Settings</strong> page and enter the IP address or hostname of the computer running MultiViewer.</p>
            <p>You can find detailed instructions in the "Getting Started" guide below.</p>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="card card--error">
          <h2>Connection Error</h2>
          <p className="error">
            Could not connect to the MultiViewer API at <strong>{multiviewerUrl}</strong>. Please check the IP/Hostname in <strong>Settings</strong> and ensure MultiViewer is running. You can find detailed instructions in the "Getting Started" guide below.
          </p>
        </div>
      )}

      {connectionStatus === 'connected' && (
        <div className="card">
          <h2>Subscription, System and Device Status</h2>
          <div className="home-screen__status-group">
            <h3>Subscription Details</h3>
            {subscriptionData.error && <p className="error">Could not load subscription data: {subscriptionData.error}</p>}
            {!subscriptionData.data && !subscriptionData.error && <p className="status">No active subscription found.</p>}
            {subscriptionData.data && (
              <>
                <p><strong>Type:</strong> {subscriptionData.data.subscriptionType}</p>
                <p><strong>Expires:</strong> {new Date(subscriptionData.data.expiresAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </>
            )}
          </div>
          <div className="home-screen__status-group">
            <h3>MultiViewer Details</h3>
            {(systemInfoData.error || versionData.error) && <p className="error">Could not load system details.</p>}
            {systemInfoData.data && versionData.data && (
              <>
                <p><strong>Version:</strong> {versionData.data}</p>
                <p><strong>Platform:</strong> {systemInfoData.data.platform}</p>
                <p><strong>Architecture:</strong> {systemInfoData.data.arch}</p>
              </>
            )}
          </div>
          <div className="home-screen__status-group">
            <h3>Device Status</h3>
            <p><strong>Screen Resolution:</strong> {width} x {height}px</p>
            <p><strong>Display Mode:</strong> {displayModeLabel}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="home-screen__tabs">
            <button
                className={`home-screen__tab-button ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
            >
                About
            </button>
            <button
                className={`home-screen__tab-button ${activeTab === 'getting-started' ? 'active' : ''}`}
                onClick={() => setActiveTab('getting-started')}
            >
                Getting Started
            </button>
            <button
                className={`home-screen__tab-button ${activeTab === 'release-notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('release-notes')}
            >
                Release Notes
            </button>
        </div>
        <div className="home-screen__tab-content">
            {activeTab === 'about' && <AboutTab />}
            {activeTab === 'getting-started' && <GettingStartedTab />}
            {activeTab === 'release-notes' && <ReleaseNotesTab />}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;