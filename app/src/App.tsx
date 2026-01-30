import Main from "@/components/main/index.tsx";
import { WindowBar, WindowFooter } from "@/components/electron";

function App() {
  return (
    <div className="electron-window-container">
      <WindowBar />
      <div className="app-content-wrapper">
        <div className="text-white h-full">
          <Main />
        </div>
      </div>
      <WindowFooter />
    </div>
  );
}

export default App;
