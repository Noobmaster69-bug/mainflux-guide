const { connect } = require("nats");
const protobuf = require("protobufjs");
const mqtt = require("mqtt");
async function main() {
  //Kết nối tới nats của mainflux
  const nc = await connect({ servers: "172.23.87.193:4222" }); // Chỗ này sửa lại thành server ip
  //Kết nối tới broker riêng. Lưu ý: broker này không được trùng với broker của mainflux
  const mqttClient = mqtt.connect("mqtt://localhost:1883");

  //subscribe vào channels.>
  const s1 = nc.subscribe("channels.>");
  console.log("subscribed to channels.>");

  // load format gói tin từ file message.proto
  const packageProtobuf = protobuf
    .loadSync("message.proto")
    .lookupType("messaging.Message");

  async function printMsgs(s) {
    // Đợi gói tin được gửi đến và xử lý
    for await (const m of s) {
      /**
       * @const decodedPackage: package đuọc decode ra từ protobuf
       */
      const decodedPackage = packageProtobuf.decode(m.data);

      /**
       * @const payload: decodedPackage payload lúc này đang là một Buffer,
       * ta cần chuyển nó qua JSON string sau đó chuyển về một object
       */
      const payload = JSON.parse(decodedPackage.payload.toString());

      /**
       * @const messageAsObject: giống như decodedPackage nhưng lúc này payload
       * là một object
       */
      const messageAsObject = { ...decodedPackage, payload };
      /**
       * @const package: Dùng hàm Normalizer để chuyển format gói tin cho giống với
       * format của reader.
       */
      const package = Normalizer(messageAsObject);

      console.log(package);
      if (mqttClient.connected) {
        //Gửi gói tin vào topic "data"
        mqttClient.publish("data", JSON.stringify(package));
      }
    }
  }

  printMsgs(s1);
  await nc.closed();
}
main();

function Normalizer(sample) {
  let tempPayload = sample.payload;
  const baseProperties = [
    { name: "ver", label: "version" },
    { name: "t", label: "time" },
    { name: "n", label: "name" },
    { name: "u", label: "unit" },
    { name: "v", label: "value" },
    { name: "s", label: "sum" },
  ];
  tempPayload = tempPayload.map((s) => {
    return baseProperties.reduce((a, { name, label }) => {
      const value = s[name] || tempPayload[0]["b" + name];
      if (value !== undefined) {
        return { ...a, [label]: value };
      }
      return a;
    }, {});
  });
  const finalResult = tempPayload.map((pl) => {
    return {
      channel: sample.channel,
      publisher: sample.publisher,
      protocol: sample.protocol,
      ...pl,
      time: pl.time,
    };
  });
  return finalResult;
}
