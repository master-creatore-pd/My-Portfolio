
import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const loginPage = document.getElementById("loginPage");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const appForm = document.getElementById("appForm");
const appList = document.getElementById("appList");

const formMessage = document.getElementById("formMessage");
const saveBtn = document.getElementById("saveBtn");

let currentUser = null;

const appsRef = collection(db, "apps");

// LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginMessage.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "";
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

// AUTH CHECK
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginPage.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadApps();
  } else {
    currentUser = null;
    dashboard.classList.add("hidden");
    loginPage.classList.remove("hidden");
  }
});

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

// LOAD APPS
async function loadApps() {
  appList.innerHTML = "<p>Loading...</p>";

  try {
    const snapshot = await getDocs(appsRef);

    document.getElementById("totalApps").textContent =
      snapshot.size;

    appList.innerHTML = "";

    if (snapshot.empty) {
      appList.innerHTML = "<p>No apps published yet.</p>";
      return;
    }

    snapshot.forEach((item) => {
      const data = item.data();

      const row = document.createElement("div");
      row.className = "app-item";

      const img = document.createElement("img");
      img.src = data.iconUrl || "";
      img.alt = "App icon";

      const info = document.createElement("div");
      info.className = "app-info";

      const title = document.createElement("strong");
      title.textContent = data.name || "Untitled";

      const version = document.createElement("p");
      version.textContent =
        "Version: " + (data.latestVersionName || "N/A");

      const packageText = document.createElement("p");
      packageText.textContent = data.packageName || "";

      info.append(title, version, packageText);

      const edit = document.createElement("button");
      edit.className = "edit-btn";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editApp(item.id));

      const remove = document.createElement("button");
      remove.className = "delete-btn";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteApp(item.id));

      row.append(img, info, edit, remove);
      appList.appendChild(row);
    });

  } catch (error) {
    appList.textContent = "Error: " + error.message;
  }
}

// ADD / UPDATE APP
appForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    formMessage.textContent = "Please login first.";
    return;
  }

  const id = document.getElementById("appId").value;

  const name = document.getElementById("appName").value.trim();
  const description =
    document.getElementById("appDescription").value.trim();
  const packageName =
    document.getElementById("packageName").value.trim();
  const iconUrl = document.getElementById("iconUrl").value.trim();
  const versionName =
    document.getElementById("versionName").value.trim();
  const versionCode = Number(
    document.getElementById("versionCode").value
  );
  const apkUrl = document.getElementById("apkUrl").value.trim();
  const whatsNew =
    document.getElementById("whatsNew").value.trim();

  if (
    !name || !description || !packageName ||
    !iconUrl || !versionName || !apkUrl ||
    !Number.isSafeInteger(versionCode) || versionCode < 1
  ) {
    formMessage.textContent = "Please enter valid information.";
    return;
  }

  if (!iconUrl.startsWith("https://") ||
      !apkUrl.startsWith("https://")) {
    formMessage.textContent = "Use HTTPS links only.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Publishing...";
  formMessage.textContent = "";

  try {
    const appData = {
      name,
      description,
      packageName,
      iconUrl,
      latestVersionName: versionName,
      latestVersionCode: versionCode,
      updatedAt: serverTimestamp()
    };

    let appDocRef;

    if (id) {
      appDocRef = doc(db, "apps", id);

      const oldDoc = await getDoc(appDocRef);

      if (!oldDoc.exists()) {
        throw new Error("App not found.");
      }

      const oldData = oldDoc.data();

      if (
        versionCode < Number(oldData.latestVersionCode || 0)
      ) {
        throw new Error("Version Code cannot be lower.");
      }

      await updateDoc(appDocRef, appData);

      // Save a version only if its version code is new.
      if (versionCode > Number(oldData.latestVersionCode || 0)) {
        await setDoc(
          doc(db, "apps", id, "versions", String(versionCode)),
          {
            versionName,
            versionCode,
            apkUrl,
            whatsNew,
            createdAt: serverTimestamp()
          }
        );
      }

    } else {
      appDocRef = await addDoc(appsRef, {
        ...appData,
        downloadCount: 0,
        createdAt: serverTimestamp()
      });

      await setDoc(
        doc(
          db,
          "apps",
          appDocRef.id,
          "versions",
          String(versionCode)
        ),
        {
          versionName,
          versionCode,
          apkUrl,
          whatsNew,
          createdAt: serverTimestamp()
        }
      );
    }

    formMessage.textContent = "App published successfully!";
    resetForm();
    await loadApps();

  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Publish App";
  }
});

// EDIT APP
async function editApp(id) {
  try {
    const ref = doc(db, "apps", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("App not found.");
      return;
    }

    const data = snap.data();

    document.getElementById("appId").value = id;
    document.getElementById("appName").value = data.name || "";
    document.getElementById("appDescription").value =
      data.description || "";
    document.getElementById("packageName").value =
      data.packageName || "";
    document.getElementById("iconUrl").value = data.iconUrl || "";
    document.getElementById("versionName").value =
      data.latestVersionName || "";
    document.getElementById("versionCode").value =
      data.latestVersionCode || "";
      
    const versionRef = doc(
      db,
      "apps",
      id,
      "versions",
      String(data.latestVersionCode)
    );

    const versionSnap = await getDoc(versionRef);

    if (versionSnap.exists()) {
      const versionData = versionSnap.data();

      document.getElementById("apkUrl").value =
        versionData.apkUrl || "";

      document.getElementById("whatsNew").value =
        versionData.whatsNew || "";
    }

    document.getElementById("formTitle").textContent = "Edit App";
    saveBtn.textContent = "Update App";
    document.getElementById("cancelEdit").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (error) {
    alert(error.message);
  }
}

// DELETE APP
async function deleteApp(id) {
  const confirmDelete = confirm(
    "Are you sure you want to delete this app and all its versions?"
  );

  if (!confirmDelete) return;

  try {
    const versionsRef = collection(db, "apps", id, "versions");
    const versions = await getDocs(versionsRef);

    for (const version of versions.docs) {
      await deleteDoc(version.ref);
    }

    await deleteDoc(doc(db, "apps", id));

    await loadApps();
    alert("App deleted successfully.");

  } catch (error) {
    alert(error.message);
  }
}

// RESET FORM
function resetForm() {
  appForm.reset();

  document.getElementById("appId").value = "";
  document.getElementById("formTitle").textContent = "Add New App";
  saveBtn.textContent = "Publish App";

  document.getElementById("cancelEdit").classList.add("hidden");
}

document.getElementById("cancelEdit").addEventListener("click", resetForm);
