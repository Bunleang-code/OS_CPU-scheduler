    // Color palette for processes
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
    ];

    // Toggle quantum input visibility
    document.getElementById("algorithm").addEventListener("change", () => {
      const algo = document.getElementById("algorithm").value;
      const quantumDiv = document.getElementById("quantumDiv");
      const mlfqConfig = document.getElementById("mlfqConfig");
      const processRows = document.querySelectorAll(".process-row");
      
      if (algo === "RR") {
        quantumDiv.classList.remove("hidden");
        mlfqConfig.classList.add("hidden");
        processRows.forEach(row => row.classList.remove("show-queue-column"));
      } else if (algo === "MLFQ") {
        quantumDiv.classList.add("hidden");
        mlfqConfig.classList.remove("hidden");
        processRows.forEach(row => row.classList.add("show-queue-column"));
      } else {
        quantumDiv.classList.add("hidden");
        mlfqConfig.classList.add("hidden");
        processRows.forEach(row => row.classList.remove("show-queue-column"));
      }
      
      // Auto-regenerate inputs if they exist to update queue column visibility
      if (processRows.length > 0) {
        generateInputs();
      }
    });

    // Generate process input fields
    function generateInputs() {
      const n = parseInt(document.getElementById("numProcesses").value);
      const container = document.getElementById("processInputs");
      const algo = document.getElementById("algorithm").value;
      
      if (n < 1 || n > 10) {
        showError("Please enter a number between 1 and 10");
        return;
      }

      clearError();
      container.innerHTML = "";

      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "process-row";
        
        // ONLY add queue column class if MLFQ is selected
        if (algo === "MLFQ") {
          row.classList.add("show-queue-column");
        }
        
        // Build base inputs
        let html = `
            <div class="process-label">P${i + 1}</div>
            <div class="input-group">
              <label>Arrival Time</label>
              <input type="number" id="at${i}" class="arrival" min="0" value="${i}" placeholder="0">
            </div>
            <div class="input-group">
              <label>Burst Time</label>
              <input type="number" id="bt${i}" class="burst" min="1" value="${Math.floor(Math.random() * 6) + 2}" placeholder="1">
            </div>
          `;

        // Only include priority queue selector for MLFQ
        if (algo === "MLFQ") {
          html += `
            <div class="input-group queue-input-group">
              <label>Priority Queue</label>
              <select id="queue${i}" class="queue-select">
                <option value="1" selected>1 (Highest)</option>
                <option value="2">2 (Medium)</option>
                <option value="3">3 (Lowest)</option>
              </select>
            </div>
          `;
        }

        row.innerHTML = html;
        container.appendChild(row);
      }
    }

    // Show error message
    function showError(message) {
      const errorContainer = document.getElementById("errorContainer");
      errorContainer.innerHTML = `<div class="error-box">${message}</div>`;
    }

    // Clear error message
    function clearError() {
      document.getElementById("errorContainer").innerHTML = "";
    }

    // Main calculation function
    function calculate() {
      try {
        clearError();
        
        const algo = document.getElementById("algorithm").value;
        const n = parseInt(document.getElementById("numProcesses").value);
        
        if (!n || n < 1) {
          showError("Please generate process inputs first");
          return;
        }

        let processes = [];
        for (let i = 0; i < n; i++) {
          const at = parseInt(document.getElementById(`at${i}`).value) || 0;
          const bt = parseInt(document.getElementById(`bt${i}`).value);
          const queueSelect = document.getElementById(`queue${i}`);
          const initialQueue = queueSelect ? parseInt(queueSelect.value) : 1;
          
          if (!bt || bt < 1) {
            showError(`Process P${i + 1}: Burst time must be at least 1`);
            return;
          }

          processes.push({
            id: "P" + (i + 1),
            at: at,
            bt: bt,
            rt: bt,
            initialQueue: initialQueue
          });
        }

        let result;
        switch (algo) {
          case "FCFS":
            result = fcfs(JSON.parse(JSON.stringify(processes)));
            break;
          case "SJF":
            result = sjf(JSON.parse(JSON.stringify(processes)));
            break;
          case "SRT":
            result = srt(JSON.parse(JSON.stringify(processes)));
            break;
          case "RR":
            const quantum = parseInt(document.getElementById("quantum").value) || 2;
            result = rr(JSON.parse(JSON.stringify(processes)), quantum);
            break;
          case "MLFQ":
            result = mlfq(JSON.parse(JSON.stringify(processes)));
            break;
          default:
            showError("Please select an algorithm");
            return;
        }

        // Merge consecutive blocks in Gantt chart
        result.gantt = mergeGanttBlocks(result.gantt);

        drawTable(result.processes);
        drawGantt(result.gantt);
        calculateAverages(result.processes, result.gantt);
        
        document.getElementById("resultsSection").classList.remove("hidden");
        
      } catch (error) {
        showError("Error: " + error.message);
        console.error(error);
      }
    }

    /* ================= SCHEDULING ALGORITHMS ================= */

    function fcfs(p) {
      let time = 0, gantt = [];
      p.sort((a, b) => a.at - b.at);

      p.forEach(proc => {
        if (time < proc.at) {
          time = proc.at;
        }
        gantt.push({ id: proc.id, start: time, end: time + proc.bt });
        proc.ft = time + proc.bt;
        time = proc.ft;
      });
      
      return finalize(p, gantt);
    }

    function sjf(p) {
      let time = 0, completed = 0, gantt = [];
      let done = new Set();

      while (completed < p.length) {
        let available = p.filter(x => x.at <= time && !done.has(x.id));
        
        if (available.length === 0) {
          time++;
          continue;
        }
        
        let shortest = available.reduce((a, b) => a.bt < b.bt ? a : b);
        gantt.push({ id: shortest.id, start: time, end: time + shortest.bt });
        time += shortest.bt;
        shortest.ft = time;
        done.add(shortest.id);
        completed++;
      }
      
      return finalize(p, gantt);
    }

    function srt(p) {
      let time = 0, completed = 0, gantt = [];

      while (completed < p.length) {
        let available = p.filter(x => x.at <= time && x.rt > 0);
        
        if (available.length === 0) {
          time++;
          continue;
        }
        
        let shortest = available.reduce((a, b) => a.rt < b.rt ? a : b);
        gantt.push({ id: shortest.id, start: time, end: time + 1 });
        shortest.rt--;
        time++;
        
        if (shortest.rt === 0) {
          shortest.ft = time;
          completed++;
        }
      }
      
      return finalize(p, gantt);
    }

    function rr(p, q) {
      let time = 0, queue = [], gantt = [];
      let arrived = new Set();
      p.sort((a, b) => a.at - b.at);

      while (p.some(x => x.rt > 0)) {
        // Add newly arrived processes
        p.forEach(x => {
          if (x.at <= time && !arrived.has(x.id) && x.rt > 0) {
            queue.push(x);
            arrived.add(x.id);
          }
        });

        if (queue.length === 0) {
          time++;
          continue;
        }

        let proc = queue.shift();
        let exec = Math.min(q, proc.rt);
        gantt.push({ id: proc.id, start: time, end: time + exec });
        time += exec;
        proc.rt -= exec;

        // Add newly arrived processes before re-adding current process
        p.forEach(x => {
          if (x.at <= time && !arrived.has(x.id) && x.rt > 0) {
            queue.push(x);
            arrived.add(x.id);
          }
        });

        if (proc.rt > 0) {
          queue.push(proc);
        } else {
          proc.ft = time;
        }
      }
      
      return finalize(p, gantt);
    }

    function mlfq(p) {
      // Get quantum values for each queue
      const q1 = parseInt(document.getElementById("q1").value) || 2;
      const q2 = parseInt(document.getElementById("q2").value) || 4;
      const q3 = parseInt(document.getElementById("q3").value) || 8;
      const quantums = [q1, q2, q3];
      
      let time = 0, gantt = [];
      let queues = [[], [], []]; // 3 priority queues
      let processQueue = {}; // Track which queue each process is in
      let arrived = new Set();
      
      p.sort((a, b) => a.at - b.at);

      // Initialize process queue tracking from input (convert 1-based to 0-based)
      p.forEach(proc => {
        processQueue[proc.id] = (proc.initialQueue || 1) - 1;
      });

      while (p.some(x => x.rt > 0)) {
        // Add newly arrived processes to their initial queue
        p.forEach(x => {
          if (x.at === time && !arrived.has(x.id)) {
            const initQueue = (x.initialQueue || 1) - 1; // Convert to 0-based index
            queues[initQueue].push(x);
            processQueue[x.id] = initQueue;
            arrived.add(x.id);
          }
        });

        // Find the highest priority non-empty queue
        let currentQueueIndex = -1;
        for (let i = 0; i < 3; i++) {
          if (queues[i].length > 0) {
            currentQueueIndex = i;
            break;
          }
        }

        // If no process is ready, increment time
        if (currentQueueIndex === -1) {
          time++;
          continue;
        }

        // Get process from highest priority queue (Round Robin - FIFO order)
        let proc = queues[currentQueueIndex].shift();
        let quantum = quantums[currentQueueIndex];
        let exec = Math.min(quantum, proc.rt);
        
        // Add to gantt with queue information and execution time
        gantt.push({ 
          id: proc.id, 
          start: time, 
          end: time + exec,
          queue: currentQueueIndex + 1,  // Store as Q1, Q2, Q3
          execTime: exec  // Store how much time was used
        });
        
        proc.rt -= exec;
        time += exec;

        // Check for newly arrived processes during execution
        p.forEach(x => {
          if (x.at > (time - exec) && x.at <= time && !arrived.has(x.id)) {
            const initQueue = (x.initialQueue || 1) - 1;
            queues[initQueue].push(x);
            processQueue[x.id] = initQueue;
            arrived.add(x.id);
          }
        });

        // Handle the process that just executed
        if (proc.rt > 0) {
          // If process used its full quantum and didn't finish, demote to lower queue
          if (exec === quantum && currentQueueIndex < 2) {
            queues[currentQueueIndex + 1].push(proc);
            processQueue[proc.id] = currentQueueIndex + 1;
          } else {
            // If interrupted before quantum expired, stay in same queue
            queues[currentQueueIndex].push(proc);
          }
        } else {
          // Process finished
          proc.ft = time;
          proc.finalQueue = currentQueueIndex + 1;
        }
      }
      
      return finalize(p, gantt);
    }

    /* ================= UTILITY FUNCTIONS ================= */

    function finalize(p, gantt) {
      p.forEach(x => {
        x.tat = x.ft - x.at;
        x.wt = x.tat - x.bt;
      });
      return { processes: p, gantt };
    }

    function mergeGanttBlocks(gantt) {
      if (gantt.length === 0) return gantt;
      
      let merged = [gantt[0]];
      
      for (let i = 1; i < gantt.length; i++) {
        let last = merged[merged.length - 1];
        let current = gantt[i];
        
        if (last.id === current.id && last.end === current.start) {
          last.end = current.end;
        } else {
          merged.push(current);
        }
      }
      
      return merged;
    }

    function calculateAverages(processes, gantt) {
      const n = processes.length;
      const totalTAT = processes.reduce((sum, p) => sum + p.tat, 0);
      const totalWT = processes.reduce((sum, p) => sum + p.wt, 0);
      const totalTime = gantt[gantt.length - 1].end;

      document.getElementById("avgTurnaround").textContent = (totalTAT / n).toFixed(2);
      document.getElementById("avgWaiting").textContent = (totalWT / n).toFixed(2);
      document.getElementById("totalTime").textContent = totalTime;
    }

    function drawTable(p) {
      const tbody = document.querySelector("#resultTable tbody");
      const algo = document.getElementById("algorithm").value;
      const queueColumn = document.querySelector(".queue-column");
      
      // Show/hide queue column based on algorithm
      if (algo === "MLFQ") {
        queueColumn.style.display = "table-cell";
      } else {
        queueColumn.style.display = "none";
      }
      
      tbody.innerHTML = "";
      
      p.forEach((x, index) => {
        const row = tbody.insertRow();
        let html = `
          <td><strong style="color: ${colors[index % colors.length]}">${x.id}</strong></td>
          <td>${x.at}</td>
          <td>${x.bt}</td>
          <td>${x.ft}</td>
          <td>${x.tat}</td>
          <td>${x.wt}</td>
        `;
        
        // Add final queue column for MLFQ
        if (algo === "MLFQ") {
          html += `<td><strong>Q${x.finalQueue || '-'}</strong></td>`;
        }
        
        row.innerHTML = html;
      });
    }

    function drawGantt(gantt) {
      const bar = document.getElementById("gantt-bar");
      const queueDiv = document.getElementById("gantt-queue");
      const timeDiv = document.getElementById("gantt-time");

      bar.innerHTML = "";
      queueDiv.innerHTML = "";
      timeDiv.innerHTML = "";

      if (gantt.length === 0) return;

      const totalTime = gantt[gantt.length - 1].end;
      let timeMarkers = new Set();
      const algo = document.getElementById("algorithm").value;

      gantt.forEach((block, index) => {
        const processNum = parseInt(block.id.substring(1)) - 1;
        const color = colors[processNum % colors.length];
        const width = ((block.end - block.start) / totalTime) * 100;

        const div = document.createElement("div");
        div.className = "gantt-block";
        div.style.width = width + "%";
        div.style.backgroundColor = color;
        div.textContent = block.id;
        
        if (algo === "MLFQ" && block.queue) {
          div.title = `${block.id} in Queue ${block.queue}: ${block.start}-${block.end} (${block.execTime} time units)`;
        } else {
          div.title = `${block.id}: ${block.start} - ${block.end}`;
        }

        bar.appendChild(div);

        timeMarkers.add(block.start);
        timeMarkers.add(block.end);
      });

      // Add queue labels for MLFQ (positioned at center of each block)
      if (algo === "MLFQ") {
        gantt.forEach((block, index) => {
          if (block.queue) {
            const start = (block.start / totalTime) * 100;
            const end = (block.end / totalTime) * 100;
            const center = (start + end) / 2;
            
            const qLabel = document.createElement("span");
            qLabel.className = "queue-label";
            qLabel.style.left = center + "%";
            qLabel.textContent = `Q${block.queue}`;
            queueDiv.appendChild(qLabel);
          }
        });
      }

      // Add time markers
      const sortedMarkers = Array.from(timeMarkers).sort((a, b) => a - b);
      sortedMarkers.forEach(time => {
        const position = (time / totalTime) * 100;
        const span = document.createElement("span");
        span.className = "time-marker";
        span.style.left = position + "%";
        span.textContent = time;
        timeDiv.appendChild(span);
      });
    }

    // Initialize on page load
    window.onload = function() {
      generateInputs();
    };
 