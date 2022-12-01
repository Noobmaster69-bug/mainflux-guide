import "./App.css";
import Chart from "react-apexcharts";

//mqtt client ở browser bắt buộc phải dụng webpack để compile và import như thế này
import mqtt from "mqtt/dist/mqtt";

import { useEffect, useState } from "react";
function App() {
  const [voltages, setVoltages] = useState([]);
  const [currents, setCurrent] = useState([]);

  //options cho chart, có thể lên trang chủ apexchart để xem thêm
  const options = {
    chart: {
      id: "realtime",
      height: 350,
      type: "line",
      animations: {
        enabled: true,
        easing: "linear",
        dynamicAnimation: {
          speed: 999,
        },
      },
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
    },
    title: {
      text: "Dynamic Updating Chart",
      align: "left",
    },
    markers: {
      size: 0,
    },
    xaxis: {
      type: "datetime",
      range: 20000,
    },
    yaxis: {
      max: 10,
    },
    legend: {
      show: false,
    },
  };

  useEffect(() => {
    //Kết nối tới broker
    const client = mqtt.connect("ws://localhost:8083/mqtt"); // thay địa chỉ trên đến broker riêng
    client.once("connect", () => {
      console.log("connected to mqtt broker");
    });
    //Subscribe channel data
    client.subscribe("data");

    //Xử lý khi có package gửi đến
    client.on("message", (_topic, message) => {
      const messageAsJSON = JSON.parse(message);

      //cập nhật các state tuỳ theo item của package
      for (const item of messageAsJSON) {
        if (item.name === "voltage") {
          setVoltages((voltages) => {
            const newArray = [
              ...voltages,
              { x: new Date(item.time * 1000), y: item.value },
            ];
            return newArray;
          });
        }
        if (item.name === "current") {
          setCurrent((currents) => {
            const newArray = [
              ...currents,
              { x: new Date(item.time * 1000), y: item.value },
            ];
            return newArray;
          });
        }
      }
    });
    // Xoá bớt giá trị của state sau một chu kì, điều này sẽ khiến glitch nhẹ đồ thị.
    //Điều này là cần thiết để tránh memory leak
    const interval = setInterval(() => {
      if (voltages.length > 20) {
        setVoltages((voltages) => {
          const tmp = [...voltages];
          tmp.splice(0, voltages.length - 20);
          return tmp;
        });
      }
      if (currents.length > 20) {
        setCurrent((currents) => {
          const tmp = [...currents];
          tmp.splice(0, currents.length - 20);
          return tmp;
        });
      }
    }, 60 * 1000);

    // Hàm dưới đây sẽ được gọi đến khi component unmout
    // Hàm này cực kì quan trọng, bắt buộc phải có nếu không sẽ dẫn đến memory leak
    return () => {
      //unsub topic data
      client.unsubscribe("data");

      //Xoá listener hiện tại
      client.removeAllListeners();

      //Ngắt kết nối tới broker
      client.end();

      //clear interval
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="App">
      <Chart
        series={[
          { data: voltages, name: "voltage" },
          { data: currents, name: "current" },
        ]}
        options={options}
      />
    </div>
  );
}

export default App;
