// Folder access for the page: every path is relative to the chosen folder and cannot leave it.
use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};
use std::{fs, io};

pub struct Store {
    pub root: Option<PathBuf>,
    cfg: PathBuf,
}

pub fn data_dir() -> PathBuf {
    home().join("Library/Application Support/Mindmap")
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
}

fn bad(m: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, m.to_string())
}

impl Store {
    pub fn load() -> Store {
        let cfg = data_dir().join("root.txt");
        let root = fs::read_to_string(&cfg).ok().map(PathBuf::from);
        Store { root, cfg }
    }

    fn set_root(&mut self, p: PathBuf) {
        let _ = fs::create_dir_all(data_dir());
        let _ = fs::write(&self.cfg, p.to_string_lossy().as_bytes());
        self.root = Some(p);
    }

    fn path(&self, rel: &str) -> io::Result<PathBuf> {
        let root = self.root.as_ref().ok_or_else(|| bad("no folder chosen"))?;
        let rel = Path::new(rel);
        if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Err(bad("path leaves the folder"));
        }
        Ok(root.join(rel))
    }

    pub fn call(&mut self, op: &str, a: &Value) -> io::Result<Value> {
        let s = |k: &str| a[k].as_str().unwrap_or("");
        Ok(match op {
            "root" => json!(self.root.as_ref().map(|p| p.to_string_lossy().to_string())),
            "pick" => {
                let dir = rfd::FileDialog::new()
                    .set_title("Choose the folder for your mind maps")
                    .set_directory(home().join("Documents"))
                    .pick_folder();
                match dir {
                    Some(d) => {
                        self.set_root(d.clone());
                        json!(d.to_string_lossy())
                    }
                    None => Value::Null,
                }
            }
            "open" => {
                let files = rfd::FileDialog::new()
                    .add_filter("Mindmap", &["kundhan", "json"])
                    .pick_files()
                    .unwrap_or_default();
                let mut out = vec![];
                for f in files {
                    let name = f.file_name().unwrap_or_default().to_string_lossy().to_string();
                    out.push(json!({ "name": name, "text": fs::read_to_string(&f)? }));
                }
                json!(out)
            }
            "list" => {
                let mut out = vec![];
                for e in fs::read_dir(self.path(s("p"))?)? {
                    let e = e?;
                    let dir = e.metadata().map(|m| m.is_dir()).unwrap_or(false);
                    out.push(json!([e.file_name().to_string_lossy(), dir]));
                }
                json!(out)
            }
            "kind" => match fs::metadata(self.path(s("p"))?) {
                Ok(m) if m.is_dir() => json!("dir"),
                Ok(_) => json!("file"),
                Err(_) => Value::Null,
            },
            "read" => json!(fs::read_to_string(self.path(s("p"))?)?),
            "write" => {
                // temp file + rename: a crash never leaves a half-written map
                let p = self.path(s("p"))?;
                if let Some(d) = p.parent() {
                    fs::create_dir_all(d)?;
                }
                let tmp = p.with_extension("tmp~");
                fs::write(&tmp, s("t"))?;
                fs::rename(&tmp, &p)?;
                Value::Null
            }
            "mkdir" => {
                fs::create_dir_all(self.path(s("p"))?)?;
                Value::Null
            }
            "rm" => {
                let p = self.path(s("p"))?;
                if p.is_dir() {
                    fs::remove_dir_all(p)?
                } else {
                    fs::remove_file(p)?
                }
                Value::Null
            }
            _ => return Err(bad("unknown op")),
        })
    }
}
