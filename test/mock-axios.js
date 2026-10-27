exports.moxios = async function (url) {
  if (url === 'https://cubeembed.rpmvid.com/') {
    return { data: `<head>\n        <meta charset="UTF-8">\n        <link rel="icon" type="image/svg+xml" href="/favicon.png">\n        <meta name="viewport" content="width=device-width, initial-scale=1.0">\n        <title>Loading...</title>\n      \x3Cscript type="module" crossorigin="" src="/assets/index-B82x0F06.js">\x3C/script>\n      <link rel="stylesheet" crossorigin="" href="/assets/index-CqMqaILZ.css">\n    <link rel="modulepreload" as="script" crossorigin="" href="/assets/vidstack-player-default-layout-DxvUdDti.js"><link rel="modulepreload" as="script" crossorigin="" href="/assets/vidstack-DM8v4Khu-DZNVoqrq.js">` }
  } else if (url.startsWith('https://cubeembed.rpmvid.com/') && url.endsWith('js')) {
    return { data: 'if(typeof i!="object")return i;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(s)}function Zy(s){var e=Xy(s,"string");return typeof e=="symbol"?e:e+""}function Sa(s){switch(s.details){case M.FRAG_LOAD_TIMEOUT:case M.KEY_LOAD_TIMEOUT:case M.LEVEL_LOAD_TIMEOUT:case M.MANIFEST_LOAD_TIMEOUT:case M.AUDIO_TRACK_LOAD_TIMEOUT:case M.SUBTITLE_TRACK_LOAD_TIMEOUT:case M.ASSET_LIST_LOAD_TIMEOUT:return!0}return!1}function m0(s){return s.details.startsWith("key")}function p0(s){return m0(s)&&!!s.frag&&!s.frag.decryptdata}function sd(s,e){const t=Sa(e);return s.default[`${t?"timeout":"error"}Retry`]}function zc(s,e){const t=s.backoff==="linear"?1:Math.pow(2,e);return Math.min(t*s.retryDelayMs,s.maxRetryDelayMs)}function nd(s){return Ee(Ee({},s),{errorRetry:null,timeoutRetry:null})}function sr(s,e,t,i){if(!s)return!1;const n=i?.code,r=e<s.maxNumRetry&&(Jy(n)||!!t);return s.shouldRetry?s.shouldRetry(s,e,t,i,r):r}function Jy(s){return nr(s)||!!s&&(s<400||s>499)}function nr(s){return s===0&&navigator.onLine===!1}function y0(s,e){return e>0&&s.loadError>0&&s.loadErrorTime!==0&&self.performance.now()-s.loadE' }
  } else if (url.startsWith('https://cubeembed.rpmvid.com/api/v1/video?id=')) {
    return { data: '5c3c11d22cf8adc991d9ac0ac45167ec52a7f25295ca29cdceaaad6be01c93b266bd5643dd661e818a45576690766946a0d3654041ac738f7f1ddd16101a8838dabf4e22ccf0c06b9c133eb84d92c081384c8c43ce6853a11dfa076d01b1e0e83db5b52e123aef1cb24d7f2b638bcfb9efdd205028187d7b939bfe3aa13c54b83560c490e8092db2053ab0ba02e02cfa5f27b2ef8e332414048b55e15809e7f634efe8e1a1a921d7d731f0e5ba455679fa6b1086d1c282a71d7fb0314838a24b463317bf686ac769f706e2059902c0414ccc0268346fe02726b47c5b2dcd817a97ab76c8e8605156eb9f9ae2e08e70549a6ebeae73e6c215d480fdbf0eebc45afef184d908749abb4d169bfec0a2559704e1a8f73a74a72cb66b4ad694219beabf2d5f4846b27837489ced1ee31d1aaec55afd156cc96f27d68e11d292a3f0147ebeb153ff3be923c901ceb1aaa419e9fda0166116855e917173e5fa7d9968f61101129b96a9d3979465a4a26c23b55e8a70606945c52632cbf0962e39a8d1457ffbe37aa137ac95d3a39c5e7481c4daccbcd4472d5ec9c544ee2ab4400af286ef1a2f1ec9b347f9cf2b8e292442c7626a98cd4439ca7e283c26c0a4e7a7ade1c002e64f5c3a22e3888c0091dd2a2abe230a79694e9b227bbe90d40014e860ebad236eef4202e95607d952896cd89b6fc1b9d1ea9a2aa52d4f78af7e2201b457ea36cffe0b6b7f52afc7455147a663431e261295915ed758f166ba52bb23d9101c7cb0289192c599e83e00bb8688b6d38298048c4e25b61f0753934fece264cb14eee19db5f78b1b891089b3343eb3ed157f28088003da77f86e3e992fcc17161b211cc23072d9619c2298dc6707b949b724c00d55c14eaebc1bdf4ac7ac98faff82e777c4a8f3b64fe5a44270654d3ef2c673f94a4ab43da535f9efcfdf7e50daf4aea57272c48fe4666d97498b738146a4bb59d81651f8e9c37cb7246840c0a8e00aa80674a2b7942b7861ba38abf31ab25605af1876fb769b910551983ec1b918e05583b93e2234b9e7a88deafbb131c2c55459e44d2c8683b9d8b9ff80f8665aa931d0b5d1f7ac4c6ab6f1b649b6e6950167112080a3f9685dc13a32ee21fa6cbdb5e37f98d38ce785f4b4970be9b372ff93fb6e3d18eca74f4642c8537ba14c88f6c45860281695450513b8eb471bb9a7be915016d09d752c0a1c12b3242a9df8b03d0c353c9728b52b459cbdb009acd523dd465701da1667f8c5b2fe62bdf49d18c73b8bcf981035b24724e3d65fdd6e9997748d21b0f571b6c13503b63993aa762d83d0a7858b0e077c9f3a39455e4883cb496f5a1ddc9ecb76f87f6113fb69fdf5360e82266809a5ed4efa5c774bd0d1c1f0ba65802ed96291c4bdb1f00b4656e173056843be48306a40e9d2b72d70bcdc51394efc54566cd14589a881249797318e395167c6257b111bcf335c749afb9cf418420c8ce6ec29ca32e50baaa395c9a2a8fc9e01814dbb1028b871d0644ee1008bd1108f9ac1c7f642bbe3c1575e17cb940786a1bf24c5d3a291a06ebc7827414934836bec5d1980d364fc8249fcaa208eec4f5656a6dc33eafe31f6af5793a085b62b554e0c4cdb6aea4359937961db7042c111740c059751428bcd646de3e92b7beb37e3acb202df9b70ab90fc642b8a805df92b186afb57b06c0d8a2e48ac2d39332a7e37286656f2b7de15bc4f77ba3d403cdbad4bcec88a856135535ffef750b8167c5e279d26a7ea7a467c0a5091b6f034df4b364745bb66c10672828dff3550142089bbfe6c120a07bab5bf2dffb5a26bae91f22cb54064c8498f489c50f98f94c82c123dfdd17fec618be3871c1b2ca18d370e297cddbf2339422b1d244c92602b4c947a230fea9766f116e202524bb8f2293770345aebb9375e862dae1fe428924534d98df4f71817b55a6a9e3d8657dd7c1cb4a511958a4e9a42953f317e80dede2c7ebd3935fcd130e28578dc8ce1c3d6cd3e264a9c3bcd00850df1632c0418fea9fe050829517e22c2933b97f7e497bbc6ff808a7b265f3c16f18e8122a5c60e2bd6665e23bbfc305bd7523f6686fa09c32b93d501ac474a635ccd0337a9304852cdaf32ce5d8f89f1075082b49536c4e29bb628d85f1b8a6678b1162661f0524d114f1423a36e31ff8b168cf9a23d92c84022816bea633ad533b42631d621f074ec02b89e800b7996b8f12d6585b7b1c5967c36b32a2f479cca943cb6a76857969fcbe9235dace34bfb5ae13410ead1e9c38fe7' }
  } else if (url.endsWith('.m3u8')) {
    return {
      data: `#EXTM3U

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="English",LANGUAGE="en",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="index-f1-a1.m3u8?v=1766826492"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Português",LANGUAGE="pt",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="index-f1-a2.m3u8?v=1766826492"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Español",LANGUAGE="es",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="index-f1-a3.m3u8?v=1766826492"

#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1173737,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.4d4028,mp4a.40.2",VIDEO-RANGE=SDR,AUDIO="audio0"
index-f1-v1.m3u8?v=1766826492
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2683454,RESOLUTION=1920x1080,FRAME-RATE=25.000,CODECS="avc1.640029,mp4a.40.2",VIDEO-RANGE=SDR,AUDIO="audio0"
index-f2-v1.m3u8?v=1766826492

`,
      status: 200
    }
  } else if (url.includes('index-f1-')) {
    return {
      data: `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-ALLOW-CACHE:YES
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:1
#EXTINF:4.000,`,
      status: 200
    }
  } else {
    return { data: "" }
  }
}