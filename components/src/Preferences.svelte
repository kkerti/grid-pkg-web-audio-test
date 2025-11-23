<svelte:options
  customElement={{ tag: "webaudioapi-preference", shadow: "none" }}
/>

<script>
  import {
    Block,
    BlockBody,
    BlockTitle,
    MoltenPushButton,
    MeltCheckbox,
  } from "@intechstudio/grid-uikit";
  import { onMount } from "svelte";

  let currentlyConnected = false;

  // @ts-ignore
  const messagePort = createPackageMessagePort(
    "package-webaudioapi",
    "preferences",
  );

  let watchForActiveWindow = false;

  $: (watchForActiveWindow, handleDataChange());

  function handleDataChange() {
    messagePort.postMessage({
      type: "set-setting",
      watchForActiveWindow,
    });
  }

  onMount(() => {

    getAudioInputDevices();

    messagePort.onmessage = (e) => {
      const data = e.data;
      if (data.type === "clientStatus") {
        currentlyConnected = data.clientConnected;
        watchForActiveWindow = data.watchForActiveWindow;
      }
    };
    messagePort.start();
    return () => {
      messagePort.close();
    };
  });

  let audioInputDevices;
  let selectedDeviceId;
  // Fetch available audio devices
  async function getAudioInputDevices() {
    try {
      // We must ask for permission first to get labels (names of devices)
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(devices);
      audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      
      // Try to find BlackHole or default to first available
      const blackhole = audioInputDevices.find(d => d.label.toLowerCase().includes('blackhole'));
      if (blackhole) {
        selectedDeviceId = blackhole.deviceId;
      } else if (audioInputDevices.length > 0 && !selectedDeviceId) {
        selectedDeviceId = audioInputDevices[0].deviceId;
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  }

  onMount(() => {
    
  });
</script>

<main-app>
  <div class="px-4 bg-secondary rounded-lg">
    <Block>
      <BlockTitle>
       Audio Capture
      </BlockTitle>
      <BlockBody>


      </BlockBody>
      <BlockBody>
        Window focus
        <MeltCheckbox
          title={"Only run actions when Window is in focus"}
          bind:target={watchForActiveWindow}
        />
        <p class="text-gray-500 text-sm font-bold mt-1">
          Note: Requires Active Window package enabled
        </p>
      </BlockBody>
    </Block>
  </div>
</main-app>
