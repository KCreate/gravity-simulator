const PI = Math.PI
const TAU = 2 * Math.PI
const G = 10
const fourThirds = 4 / 3
const canvas_side = 1000
const scaledownfactor = 100000
const body_min_radius = 5
const orbit_trace_decay = 0.05
const com_radius = 3

/*
 * Represents a single object with mass and absolute velocity
 * */
class Body {
  constructor(mass, posx, posy, velx, vely, type) {
    this.mass = mass
    this.posx = posx
    this.posy = posy
    this.velx = velx
    this.vely = vely
    this.type = type
  }
}

/*
 * Represents a single simulation context
 * */
class Simulation {
  constructor(canvas) {
    this.bodies = [];
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.camerax = 0;
    this.cameray = 0;
  }

  focus_body(body) {
    this.camerax = body.posx - canvas_side / 2
    this.cameray = body.posy - canvas_side / 2
  }

  add_body(body) {
    this.bodies.push(body);
  }

  step() {

    // Apply graviational forces
    this.bodies.map((source) => {
      this.bodies.map((other) => {
        if (source === other) return;

        // Calculate the distance between the two bodies
        const delx = other.posx - source.posx;
        const dely = other.posy - source.posy;
        const distance = Math.sqrt(delx * delx + dely * dely)

        // Calculate the graviational attraction based on the distance
        // between the two bodies
        //
        // Formula: Fg = G * ((m1 * m2) / d^2)
        //
        // NOTE: m2 is set to 1 to only calculate the force exerted
        // onto the source object by the other object
        const force = G * ((source.mass * other.mass) / (distance * distance))

        // Divide the force into it's x and y components
        const fx = (force / distance) * delx
        const fy = (force / distance) * dely

        // Apply the force to the source object
        const ax = fx / source.mass
        const ay = fy / source.mass

        source.velx += ax
        source.vely += ay
      })
    })

    // Move the bodies
    this.bodies.map((body) => {
      body.posx += body.velx
      body.posy += body.vely
    })
  }

  radius_for_mass(mass) {
    const i1 = Math.cbrt(mass / (fourThirds * PI)) / scaledownfactor
    return Math.max(i1, body_min_radius)
  }

  render() {

    this.context.fillStyle = "black"
    this.context.globalAlpha = orbit_trace_decay
    this.context.fillRect(0, 0, canvas_side, canvas_side)
    this.context.globalAlpha = 1

    // Render the bodies
    this.bodies.map((body) => {

      // calculate radius of body based on its mass
      const radius = this.radius_for_mass(body.mass)
      this.context.beginPath()
      this.context.arc(body.posx - this.camerax, body.posy - this.cameray, radius, 0, TAU)

      // set body color
      this.context.fillStyle = "red"
      if (body.type == "star") this.context.fillStyle = "yellow"
      if (body.type == "planet") this.context.fillStyle = "red"

      // draw the body
      this.context.closePath()
      this.context.fill()
    })

    // Calculate the center of mass
    let tmpx = 0, tmpy = 0, mt = 0
    this.bodies.map((body) => {
      tmpx += body.mass * body.posx
      tmpy += body.mass * body.posy
      mt += body.mass
    })

    // Draw the center of mass on the canvas
    const comx = tmpx / mt
    const comy = tmpy / mt

    this.context.beginPath()
    this.context.arc(comx - this.camerax, comy - this.cameray, com_radius, 0, TAU)
    this.context.fillStyle = "green"
    this.context.closePath()
    this.context.fill()
  }

  clear_canvas() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

const main_canvas = document.getElementById("main_canvas")
main_canvas.width = canvas_side
main_canvas.height = canvas_side

const massSun = 800
const massPlanet = 1

const star = new Body(massSun, 500, 500, 0, 0, "star")
const main_simulation = new Simulation(main_canvas)
main_simulation.add_body(star)

main_simulation.add_body(
  new Body(
    massPlanet,
    750,
    200,
    0,
    3,
    "planet"
  )
)

main_simulation.render()

const fps = 64
setInterval(() => {
  main_simulation.step()
  main_simulation.focus_body(star)
  main_simulation.render()
}, 1000 / fps)


























