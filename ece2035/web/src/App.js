import './App.css';
import MemoryView from './views/MemoryView';
import ScreenView from './views/ScreenView';
import { useEffect, useRef, useState } from 'react';
import { base64ToBytes } from './util/hexUtils';

// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

export const BYTES_PER_ROW = 4;

function handleReadMemory({ mainMemory, stackMemory, gp, sp, setMemoryData, setStackData, setGp, setSp }) {
  // data is base64, decode it
  const stackDecoded = base64ToBytes(stackMemory);
  const memoryDecoded = base64ToBytes(mainMemory);

  setMemoryData(memoryDecoded);
  setStackData(stackDecoded);
  setGp(gp["value"]);
  setSp(sp);

  if (!initialized) {
    initialized = true;
  }
}

let initialized = false;

function App() {
  const oldMemory = useRef(new Array(128).fill(0));

  const [stackData, setStackData] = useState(new Array(128).fill(0));
  const [memoryData, setMemoryData] = useState(new Array(128).fill(0));
  const [gp, setGp] = useState(0);
  const [sp, setSp] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      console.log("Received 1", event.data);

      const { command, data } = event.data;

      switch (command) {
        case "read_memory":
          handleReadMemory({
            mainMemory: data.mainMemory,
            stackMemory: data.stackMemory,
            gp: data.gp,
            sp: data.sp,
            setMemoryData: setMemoryData,
            setStackData: setStackData,
            setGp: setGp,
            setSp: setSp,
          });

          setIsDebugging(true);
          break;
        case "show_past_screen":
          setIsDebugging(false);
          break;
        default:
          break;
      }
    });

    // To prevent the risk of data being sent to the website before loading,
    // all commands will enter a queue until this ready command is posted
    vscode.postMessage({ command: 'ready' });

  }, [])

  const baseAddress = 0;

  const dumpToMemory = () => {

    // memory is int[] for each byte, combine every 4 
    let output = "";


    for (let i = 0; i < memoryData.length; i += 4) {

      let val = memoryData[i] + memoryData[i + 1]
        + memoryData[i + 2] + memoryData[i + 3];

      let line = String(val).padStart(10, " ");

      line = i + line + ":" + val;

      output += line + "\n";
    }

    navigator.clipboard.writeText(output);
  }

  return (
    <>
      <ScreenView vscode={vscode} />

      {isDebugging ? <>

        <div style={{ display: "flex", flexDirection: "column", rowGap: "0.5rem" }}>

          <button onClick={dumpToMemory} id="save_button" style={{ marginRight: "0.50rem", height: "2rem" }} className="primary-button">Dump Memory</button>
        </div>

        <div className='flex-container'>
          <div>
            <MemoryView showInstructions={showInstructions} title={"Memory"} gp={gp} baseAddress={baseAddress} memoryData={memoryData} oldMemory={oldMemory} />
          </div>
          <div>
            <MemoryView reverse={true} showInstructions={showInstructions} title={"Stack"} gp={gp} baseAddress={sp} memoryData={stackData} oldMemory={oldMemory} />
          </div>
        </div></> : <></>}
    </>
  );
}

export default App;
