
        // ========== DATA ==========
        const employee = {
            name: "Alex Mercer",
            id: "EMP10234",
            department: "Engineering",
            designation: "Senior Developer",
            pan: "ABCDE1234F",
            bank: "HDFC Bank",
            account: "XXXX6789012",
            ifsc: "HDFC0001234",
            location: "Bangalore",
            joiningDate: "01 Jun 2020",
        };

        const payslipData = [
            {
                month: "March", year: 2025, period: "01 Mar 2025 – 31 Mar 2025", workingDays: 26, paidDays: 26,
                earnings: { basic: 85000, hra: 34000, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 10000 },
                deductions: { pf: 10200, professionalTax: 200, incomeTax: 5408, esi: 0 },
            },
            {
                month: "February", year: 2025, period: "01 Feb 2025 – 28 Feb 2025", workingDays: 20, paidDays: 20,
                earnings: { basic: 85000, hra: 34000, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 0 },
                deductions: { pf: 10200, professionalTax: 200, incomeTax: 5408, esi: 0 },
            },
            {
                month: "January", year: 2025, period: "01 Jan 2025 – 31 Jan 2025", workingDays: 27, paidDays: 27,
                earnings: { basic: 85000, hra: 34000, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 0 },
                deductions: { pf: 10200, professionalTax: 200, incomeTax: 5408, esi: 0 },
            },
            {
                month: "December", year: 2024, period: "01 Dec 2024 – 31 Dec 2024", workingDays: 26, paidDays: 25,
                earnings: { basic: 82060, hra: 32824, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 0 },
                deductions: { pf: 9847, professionalTax: 200, incomeTax: 5204, esi: 0 },
            },
            {
                month: "November", year: 2024, period: "01 Nov 2024 – 30 Nov 2024", workingDays: 25, paidDays: 25,
                earnings: { basic: 85000, hra: 34000, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 5000 },
                deductions: { pf: 10200, professionalTax: 200, incomeTax: 5408, esi: 0 },
            },
            {
                month: "October", year: 2024, period: "01 Oct 2024 – 31 Oct 2024", workingDays: 27, paidDays: 27,
                earnings: { basic: 85000, hra: 34000, conveyance: 1600, medicalAllowance: 1250, specialAllowance: 12500, performanceBonus: 0 },
                deductions: { pf: 10200, professionalTax: 200, incomeTax: 5408, esi: 0 },
            },
        ];

        // ========== HELPERS ==========
        function fmtINR(n) {
            if (n === 0) return "₹0";
            return "₹" + n.toLocaleString("en-IN");
        }

        function getTotals(slip) {
            const gross = Object.values(slip.earnings).reduce((a, b) => a + b, 0);
            const deductions = Object.values(slip.deductions).reduce((a, b) => a + b, 0);
            const net = gross - deductions;
            return { gross, deductions, net };
        }

        const earningsLabels = {
            basic: "Basic Salary",
            hra: "House Rent Allowance (HRA)",
            conveyance: "Conveyance Allowance",
            medicalAllowance: "Medical Allowance",
            specialAllowance: "Special Allowance",
            performanceBonus: "Performance Bonus",
        };

        const deductionsLabels = {
            pf: "Provident Fund (PF)",
            professionalTax: "Professional Tax",
            incomeTax: "Income Tax (TDS)",
            esi: "ESI",
        };

        function numberToWords(num) {
            const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
            const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
            function inWords(n) {
                if (n < 20) return a[n];
                if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
                if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
                if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
                if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
                return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
            }
            return inWords(num) + " Rupees Only";
        }

        // ========== RENDER PAYSLIP CARDS ==========
        function renderPayslipCards() {
            const grid = document.getElementById("payslipGrid");
            grid.innerHTML = payslipData.map((slip, idx) => {
                const { gross, deductions, net } = getTotals(slip);
                return `
    <div class="payslip-card" onclick="openPayslipModal(${idx})">
      <div class="payslip-card-header">
        <div>
          <div class="payslip-month">${slip.month} ${slip.year}</div>
          <div class="payslip-year">${slip.period}</div>
        </div>
        <span class="payslip-status-badge paid"><i class="fas fa-check-circle"></i> Paid</span>
      </div>
      <div class="payslip-card-body">
        <div class="payslip-net">${fmtINR(net)}</div>
        <div class="payslip-breakdown">
          <div class="payslip-breakdown-item">
            <div class="breakdown-label">Gross</div>
            <div class="breakdown-value earn">${fmtINR(gross)}</div>
          </div>
          <div class="payslip-breakdown-item">
            <div class="breakdown-label">Deductions</div>
            <div class="breakdown-value deduct">-${fmtINR(deductions)}</div>
          </div>
          <div class="payslip-breakdown-item">
            <div class="breakdown-label">Net Pay</div>
            <div class="breakdown-value net">${fmtINR(net)}</div>
          </div>
        </div>
      </div>
      <div class="payslip-card-footer">
        <span><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${slip.paidDays}/${slip.workingDays} days</span>
        <button class="btn-view-slip" onclick="event.stopPropagation(); openPayslipModal(${idx})">
          <i class="fas fa-eye"></i> View Payslip
        </button>
      </div>
    </div>`;
            }).join("");
        }

        // ========== RENDER PAYSLIP DETAIL ==========
        let currentSlipIndex = 0;

        function openPayslipModal(idx) {
            currentSlipIndex = idx;
            const slip = payslipData[idx];
            const { gross, deductions, net } = getTotals(slip);

            let earningsRows = Object.entries(slip.earnings).map(([key, val]) =>
                val > 0 ? `<tr><td>${earningsLabels[key]}</td><td>${fmtINR(val)}</td></tr>` : ""
            ).join("");

            let deductionsRows = Object.entries(slip.deductions).map(([key, val]) =>
                val > 0 ? `<tr><td>${deductionsLabels[key]}</td><td>${fmtINR(val)}</td></tr>` : ""
            ).join("");

            document.getElementById("payslipDocContent").innerHTML = `
  <div class="slip-company-header">
    <div class="slip-company-logo">
      <div class="slip-company-logo-icon"><i class="fas fa-briefcase"></i></div>
      <div>
        <div class="slip-company-name">TechNova Solutions Pvt. Ltd.</div>
        <div class="slip-company-tagline">12th Floor, Brigade Tower, MG Road, Bengaluru – 560001 | CIN: U72200KA2015PTC082345</div>
      </div>
    </div>
    <div class="slip-payslip-title">
      <h3>PAYSLIP</h3>
      <p>${slip.period}</p>
    </div>
  </div>

  <div class="slip-emp-grid">
    <div class="slip-emp-col">
      <div class="slip-emp-row"><span class="slip-emp-label">Employee Name</span><span class="slip-emp-value">${employee.name}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Employee ID</span><span class="slip-emp-value">${employee.id}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Designation</span><span class="slip-emp-value">${employee.designation}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Department</span><span class="slip-emp-value">${employee.department}</span></div>
    </div>
    <div class="slip-emp-col">
      <div class="slip-emp-row"><span class="slip-emp-label">PAN Number</span><span class="slip-emp-value">${employee.pan}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Bank Account</span><span class="slip-emp-value">${employee.account}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Bank / IFSC</span><span class="slip-emp-value">${employee.bank} / ${employee.ifsc}</span></div>
      <div class="slip-emp-row"><span class="slip-emp-label">Paid Days / Working Days</span><span class="slip-emp-value">${slip.paidDays} / ${slip.workingDays}</span></div>
    </div>
  </div>

  <div class="slip-two-col">
    <div>
      <div class="slip-table-title"><i class="fas fa-plus-circle" style="color:var(--success)"></i> Earnings</div>
      <table class="slip-table">
        <thead><tr><th>Component</th><th>Amount</th></tr></thead>
        <tbody>${earningsRows}</tbody>
        <tfoot><tr><td>Total Earnings</td><td>${fmtINR(gross)}</td></tr></tfoot>
      </table>
    </div>
    <div>
      <div class="slip-table-title"><i class="fas fa-minus-circle" style="color:var(--danger)"></i> Deductions</div>
      <table class="slip-table">
        <thead><tr><th>Component</th><th>Amount</th></tr></thead>
        <tbody>${deductionsRows}</tbody>
        <tfoot><tr><td>Total Deductions</td><td>${fmtINR(deductions)}</td></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="slip-net-section">
    <div>
      <div class="slip-net-label">NET PAY FOR ${slip.month.toUpperCase()} ${slip.year}</div>
      <div class="slip-net-amount">${fmtINR(net)}</div>
      <div class="slip-net-sub">Credited to ${employee.bank} (${employee.account})</div>
    </div>
    <div class="slip-net-breakdown">
      <div class="slip-net-item"><div class="label">Gross Earnings</div><div class="value">${fmtINR(gross)}</div></div>
      <div class="slip-net-item"><div class="label">Total Deductions</div><div class="value">−${fmtINR(deductions)}</div></div>
    </div>
  </div>

  <div class="slip-words-section">
    <div class="slip-words-label">Amount in Words</div>
    <div class="slip-words-value">${numberToWords(net)}</div>
  </div>

  <div class="slip-footer">
    <div class="slip-footer-note">
      <i class="fas fa-info-circle" style="margin-right:4px;color:var(--primary)"></i>
      This is a computer-generated payslip and does not require a physical signature.
    </div>
    <div class="slip-signature">
      <div class="sig-line"></div>
      <span>Authorised Signatory</span>
    </div>
  </div>`;

            document.getElementById("modalOverlay").classList.add("active");
        }

        // ========== PDF DOWNLOAD ==========
        document.getElementById("downloadPdfBtn").onclick = function () {
            const slip = payslipData[currentSlipIndex];
            const { gross, deductions, net } = getTotals(slip);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "mm", format: "a4" });

            const PRIMARY = [31, 111, 127];
            const PRIMARY_DARK = [20, 92, 107];
            const SOFT = [230, 244, 246];
            const TEXT = [51, 65, 85];
            const MUTED = [100, 116, 139];
            const SUCCESS = [111, 175, 46];
            const DANGER = [229, 108, 108];
            const W = 210, M = 14;

            // Company Header Bar
            doc.setFillColor(...PRIMARY);
            doc.roundedRect(M, 10, W - M * 2, 24, 4, 4, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("TechNova Solutions Pvt. Ltd.", M + 6, 19);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text("12th Floor, Brigade Tower, MG Road, Bengaluru – 560001", M + 6, 25);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("PAYSLIP", W - M - 6, 19, { align: "right" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(slip.period, W - M - 6, 25, { align: "right" });

            let y = 40;

            // Employee Info Grid
            doc.setFillColor(...SOFT);
            doc.roundedRect(M, y, W - M * 2, 34, 3, 3, "F");
            const leftData = [
                ["Employee Name", employee.name],
                ["Employee ID", employee.id],
                ["Designation", employee.designation],
                ["Department", employee.department],
            ];
            const rightData = [
                ["PAN Number", employee.pan],
                ["Bank / IFSC", `${employee.bank} / ${employee.ifsc}`],
                ["Bank Account", employee.account],
                ["Paid / Working Days", `${slip.paidDays} / ${slip.workingDays} Days`],
            ];
            const colLeft = M + 4, colRight = W / 2 + 4;
            leftData.forEach(([label, value], i) => {
                doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
                doc.text(label, colLeft, y + 6 + i * 8);
                doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...TEXT);
                doc.text(value, colLeft, y + 10 + i * 8);
            });
            rightData.forEach(([label, value], i) => {
                doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
                doc.text(label, colRight, y + 6 + i * 8);
                doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...TEXT);
                doc.text(value, colRight, y + 10 + i * 8);
            });

            y += 40;

            // Earnings table
            const earningRows = Object.entries(slip.earnings)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => [earningsLabels[k], fmtINR(v)]);
            earningRows.push(["Total Earnings", fmtINR(gross)]);

            const deductionRows = Object.entries(slip.deductions)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => [deductionsLabels[k], fmtINR(v)]);
            deductionRows.push(["Total Deductions", fmtINR(deductions)]);

            const tableMaxRows = Math.max(earningRows.length, deductionRows.length);
            const colW = (W - M * 2 - 6) / 2;

            // Earnings header
            doc.setFillColor(...PRIMARY);
            doc.roundedRect(M, y, colW, 8, 2, 2, "F");
            doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
            doc.text("Earnings", M + 4, y + 5.5);

            // Deductions header
            doc.setFillColor(...DANGER);
            doc.roundedRect(M + colW + 6, y, colW, 8, 2, 2, "F");
            doc.setTextColor(255, 255, 255);
            doc.text("Deductions", M + colW + 10, y + 5.5);

            y += 10;

            // Table rows
            earningRows.forEach((row, i) => {
                const isTotal = i === earningRows.length - 1;
                if (isTotal) { doc.setFillColor(...SOFT); doc.rect(M, y, colW, 7, "F"); }
                doc.setFont("helvetica", isTotal ? "bold" : "normal");
                doc.setFontSize(isTotal ? 9 : 8.5);
                doc.setTextColor(...TEXT);
                doc.text(row[0], M + 3, y + 5);
                doc.text(row[1], M + colW - 3, y + 5, { align: "right" });
                if (!isTotal) { doc.setDrawColor(...[226, 232, 240]); doc.line(M, y + 7, M + colW, y + 7); }
                y += 7;
            });

            let y2 = y - earningRows.length * 7;
            deductionRows.forEach((row, i) => {
                const isTotal = i === deductionRows.length - 1;
                if (isTotal) { doc.setFillColor(...SOFT); doc.rect(M + colW + 6, y2, colW, 7, "F"); }
                doc.setFont("helvetica", isTotal ? "bold" : "normal");
                doc.setFontSize(isTotal ? 9 : 8.5);
                doc.setTextColor(...TEXT);
                doc.text(row[0], M + colW + 9, y2 + 5);
                doc.text(row[1], M + colW * 2 + 3, y2 + 5, { align: "right" });
                if (!isTotal) { doc.setDrawColor(...[226, 232, 240]); doc.line(M + colW + 6, y2 + 7, M + colW * 2 + 6, y2 + 7); }
                y2 += 7;
            });

            y = Math.max(y, y2) + 8;

            // Net Pay Banner
            doc.setFillColor(...PRIMARY_DARK);
            doc.roundedRect(M, y, W - M * 2, 22, 4, 4, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9);
            doc.text(`NET PAY FOR ${slip.month.toUpperCase()} ${slip.year}`, M + 6, y + 8);
            doc.setFont("helvetica", "bold"); doc.setFontSize(18);
            doc.text(fmtINR(net), M + 6, y + 18);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
            doc.text(`Gross: ${fmtINR(gross)}`, W - M - 50, y + 10, { align: "left" });
            doc.text(`Deductions: -${fmtINR(deductions)}`, W - M - 50, y + 17, { align: "left" });

            y += 28;

            // Amount in words
            doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, W - M * 2, 12, 3, 3, "F");
            doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
            doc.text("Amount in Words:", M + 4, y + 5);
            doc.setTextColor(...TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
            doc.text(numberToWords(net), M + 4, y + 10);

            y += 18;

            // Footer
            doc.setDrawColor(...MUTED); doc.setLineDash([2, 2]); doc.line(M, y, W - M, y); doc.setLineDash([]);
            y += 5;
            doc.setTextColor(...MUTED); doc.setFont("helvetica", "italic"); doc.setFontSize(7.5);
            doc.text("* This is a computer-generated payslip and does not require a physical signature.", M, y + 4);
            doc.setFont("helvetica", "bold"); doc.setFontSize(8);
            doc.text("Authorised Signatory", W - M - 6, y + 8, { align: "right" });
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
            doc.text("TechNova Solutions Pvt. Ltd.", W - M - 6, y + 13, { align: "right" });

            // Page number
            doc.setFontSize(7); doc.setTextColor(...MUTED);
            doc.text(`Page 1 of 1  |  Generated on ${new Date().toLocaleDateString("en-IN")}`, W / 2, 290, { align: "center" });

            const filename = `Payslip_${employee.name.replace(/ /g, "_")}_${slip.month}_${slip.year}.pdf`;
            doc.save(filename);
            showToast(`✓ ${slip.month} ${slip.year} payslip downloaded!`, "#6FAF2E");
        };

        // ========== TOAST ==========
        function showToast(msg, bg) {
            Toastify({
                text: msg, duration: 3000, gravity: "bottom", position: "right",
                backgroundColor: bg || "#1f6f7f",
                style: { borderRadius: "10px", padding: "12px 16px", fontSize: "14px", fontWeight: "500" }
            }).showToast();
        }

        // ========== SIDEBAR ==========
        document.getElementById("collapseSidebarBtn").onclick = () => {
            document.getElementById("sidebar").classList.toggle("collapsed");
            document.getElementById("mainContent").classList.toggle("sidebar-collapsed");
        };
        document.getElementById("mobileToggleBtn").onclick = () =>
            document.getElementById("sidebar").classList.toggle("mobile-open");

        // ========== PROFILE DROPDOWN ==========
        const profileBtn = document.getElementById("profileDropdownBtn");
        const profileDropdown = document.getElementById("profileDropdown");
        profileBtn.addEventListener("click", e => { e.stopPropagation(); profileDropdown.classList.toggle("active"); });
        document.addEventListener("click", () => profileDropdown.classList.remove("active"));
        document.addEventListener("keydown", e => { if (e.key === "Escape") profileDropdown.classList.remove("active"); });

        // ========== MODAL CLOSE ==========
        document.getElementById("closeModalBtn").onclick = () =>
            document.getElementById("modalOverlay").classList.remove("active");
        document.getElementById("modalOverlay").addEventListener("click", function (e) {
            if (e.target === this) this.classList.remove("active");
        });

        // ========== INIT ==========
        renderPayslipCards();